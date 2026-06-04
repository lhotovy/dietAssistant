import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { chatStopWhen } from "@/lib/chat-stop";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { buildDateContext } from "@/lib/date-context";
import { parseRecipe, slugify } from "@/lib/recipe-utils";
import { getUserId } from "@/lib/user";
import {
  enrichMealPlanDays,
  validateAndResolveMealPlanDays,
} from "@/lib/meal-plan-validate";
import { resolvePlanningCatalogContext } from "@/lib/planning-catalog";
import { getRecipeCatalogIndex } from "@/lib/recipe-catalog-match";
import { persistChatSession } from "@/lib/chat-session-persist";
import {
  buildExistingPlansContext,
  detectMealPlanWeekConflict,
  withWeekConflict,
} from "@/lib/meal-plan-conflicts";
import { clearRecipeCatalogCache } from "@/lib/recipe-catalog-match";
import { clearPlanningCatalogCache } from "@/lib/planning-catalog";
import { createMealPlanForUser } from "@/lib/meal-plan-store";
import { getUserMealPlanRecords } from "@/lib/meal-plan-user-plans";
import type { MealPlanDay } from "@/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json();
  const messages: UIMessage[] = body.messages ?? [];
  const sessionId: string | undefined = body.sessionId;
  const catalogVersion: string | undefined =
    typeof body.catalogVersion === "string" ? body.catalogVersion : undefined;

  const userId = await getUserId();

  const favoritesContext =
    "Oblíbené recepty jsou v katalogu označené ★ u příslušného recipeId.";

  const [catalogContext, modelMessages, userMealPlans] = await Promise.all([
    resolvePlanningCatalogContext(userId, catalogVersion),
    convertToModelMessages(messages),
    getUserMealPlanRecords(userId),
  ]);
  const recipeCatalogContext = catalogContext.contextText;

  await getRecipeCatalogIndex();

  const existingPlansContext = buildExistingPlansContext(userMealPlans);

  const mealPlanMealSchema = z.object({
    type: z.enum(["snidane", "obed", "vecere", "svacina", "dessert"]),
    recipeId: z
      .string()
      .describe(
        "recipeId (cuid) z katalogu — prvni token radku pred |. Neposilej nazev jidla."
      ),
  });

  const mealPlanDaysSchema = z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      meals: z.array(mealPlanMealSchema),
    })
  );

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: buildSystemPrompt(
      favoritesContext,
      buildDateContext(),
      recipeCatalogContext,
      existingPlansContext
    ),
    messages: modelMessages,
    tools: {
      searchRecipes: tool({
        description:
          "Vyhledá recepty pouze v databázi této aplikace (ne internet). Pro jídelní plán máš katalog v kontextu — searchRecipes volaj jen když potřebuješ ověřit konkrétní název nebo id. Výsledek: pole s id — toto id použij v plánu. Nevymýšlej recepty.",
        inputSchema: z.object({
          query: z.string().describe("Hledaný výraz nebo název receptu"),
          mealTypes: z
            .array(z.enum(["snidane", "obed", "vecere", "svacina", "dessert"]))
            .optional()
            .describe("Typy jídel k filtrování"),
          availableIngredients: z
            .array(z.string())
            .optional()
            .describe("Seznam dostupných ingrediencí"),
        }),
        execute: async ({ query, mealTypes, availableIngredients }) => {
          const andConditions: Record<string, unknown>[] = [];

          if (query) {
            andConditions.push({
              OR: [
                { name: { contains: query } },
                { description: { contains: query } },
                { tags: { contains: query } },
              ],
            });
          }

          if (mealTypes && mealTypes.length > 0) {
            andConditions.push({
              OR: mealTypes.map((t) => ({ mealTypes: { contains: t } })),
            });
          }

          if (availableIngredients && availableIngredients.length > 0) {
            andConditions.push({
              OR: availableIngredients.map((i) => ({
                ingredients: { contains: i },
              })),
            });
          }

          const recipes = await prisma.recipe.findMany({
            where: andConditions.length > 0 ? { AND: andConditions } : {},
            take: 15,
            orderBy: { name: "asc" },
          });

          return recipes.map(parseRecipe);
        },
      }),

      saveRecipeToFavorites: tool({
        description:
          "Uloží recept do oblíbených uživatelky. Použij, pokud o to uživatelka požádá.",
        inputSchema: z.object({
          recipeId: z
            .string()
            .optional()
            .describe("ID receptu z databáze, pokud existuje"),
          name: z.string().describe("Název receptu"),
          notes: z.string().optional().describe("Poznámka uživatelky k receptu"),
          ingredients: z
            .array(
              z.object({
                name: z.string(),
                amount: z.number(),
                unit: z.string(),
              })
            )
            .optional()
            .describe("Ingredience (pokud jde o nový recept)"),
          instructions: z
            .array(z.string())
            .optional()
            .describe("Postup přípravy (pokud jde o nový recept)"),
        }),
        execute: async ({ recipeId, name, notes, ingredients, instructions }) => {
          const favorite = await prisma.favorite.create({
            data: {
              userId,
              recipeId: recipeId ?? null,
              customName: recipeId ? null : name,
              customIngredients: ingredients
                ? JSON.stringify(ingredients)
                : null,
              customInstructions: instructions
                ? JSON.stringify(instructions)
                : null,
              notes: notes ?? null,
            },
          });
          return { success: true, favoriteId: favorite.id, name };
        },
      }),

      prepareMealPlan: tool({
        description:
          "Sestavi jidelni plan z recipeId z katalogu. Neposilej recipeName — vrati se z DB. Do DB neuklada. Po zavolani v chatu nic nepis.",
        inputSchema: z.object({
          title: z.string(),
          startDate: z.string().describe("YYYY-MM-DD"),
          endDate: z.string().describe("YYYY-MM-DD"),
          days: mealPlanDaysSchema,
        }),
        execute: async ({ title, startDate, endDate, days }) => {
          const validation = await validateAndResolveMealPlanDays(
            days as MealPlanDay[]
          );
          if (!validation.ok) {
            return {
              success: false,
              error: validation.error,
              ...(validation.invalidRecipeIds
                ? { invalidRecipeIds: validation.invalidRecipeIds }
                : {}),
              ...(validation.invalidMeals
                ? { invalidMeals: validation.invalidMeals }
                : {}),
            };
          }
          const enriched = await enrichMealPlanDays(validation.days);

          return withWeekConflict(
            {
              type: "mealPlan",
              title,
              startDate,
              endDate,
              days: enriched,
            },
            userMealPlans
          );
        },
      }),

      saveMealPlan: tool({
        description:
          "Uloží jídelní plán do databáze. Jen bez kolize týdne a na výslovnou žádost. Po úspěchu nepiš v chatu ze plán byl ulozen — UI zobrazi potvrzeni samo.",
        inputSchema: z.object({
          title: z.string(),
          startDate: z.string().describe("YYYY-MM-DD"),
          endDate: z.string().describe("YYYY-MM-DD"),
          days: mealPlanDaysSchema,
        }),
        execute: async ({ title, startDate, endDate, days }) => {
          const validation = await validateAndResolveMealPlanDays(
            days as MealPlanDay[]
          );
          if (!validation.ok) {
            return {
              success: false,
              error: validation.error,
              ...(validation.invalidRecipeIds
                ? { invalidRecipeIds: validation.invalidRecipeIds }
                : {}),
              ...(validation.invalidMeals
                ? { invalidMeals: validation.invalidMeals }
                : {}),
            };
          }

          const dayList = validation.days as MealPlanDay[];
          const conflict = detectMealPlanWeekConflict(userMealPlans, {
            startDate,
            endDate,
            days: dayList,
          });
          if (conflict) {
            return {
              success: false,
              error:
                "Pro tento týden už existuje uložený plán. Uložení je možné až po zvolení jiného období.",
              weekConflict: conflict,
            };
          }

          const result = await createMealPlanForUser(userId, {
            title,
            startDate,
            endDate,
            days: dayList,
          });
          if (!result.ok) {
            return { success: false, error: result.error };
          }
          return {
            type: "mealPlanSaved",
            success: true,
            planId: result.planId,
            title: result.title,
            startDate: result.startDate,
            endDate: result.endDate,
            days: result.days,
          };
        },
      }),

      createRecipeInDatabase: tool({
        description:
          "Uloží nový recept do databáze. Použij jen když uživatelka výslovně chce recept z internetu / mimo katalog — nejdřív recept popiš (nízkohistaminově), pak ulož a použij vrácené recipeId v plánech. Nabídně jí uložení do databáze.",
        inputSchema: z.object({
          name: z.string(),
          description: z.string(),
          mealTypes: z.array(
            z.enum(["snidane", "obed", "vecere", "svacina", "dessert"])
          ),
          ingredients: z.array(
            z.object({
              name: z.string(),
              amount: z.number(),
              unit: z.string(),
            })
          ),
          instructions: z.array(z.string()),
          prepTime: z.number(),
          cookTime: z.number(),
          servings: z.number(),
          tags: z.array(z.string()).optional(),
        }),
        execute: async ({
          name,
          description,
          mealTypes,
          ingredients,
          instructions,
          prepTime,
          cookTime,
          servings,
          tags,
        }) => {
          let slug = slugify(name);
          const existing = await prisma.recipe.findFirst({ where: { slug } });
          if (existing) slug = `${slug}-${Date.now()}`;
          const recipe = await prisma.recipe.create({
            data: {
              name,
              slug,
              description,
              mealTypes: mealTypes.join(","),
              ingredients: JSON.stringify(ingredients),
              instructions: JSON.stringify(instructions),
              prepTime,
              cookTime,
              servings,
              tags: (tags ?? []).join(","),
            },
          });
          clearRecipeCatalogCache();
          clearPlanningCatalogCache();
          return { success: true, recipeId: recipe.id, name };
        },
      }),
    },
    stopWhen: chatStopWhen,
  });

  // Keep streaming on the server after the client disconnects (tab navigation).
  result.consumeStream();

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: allMessages }) => {
      if (sessionId) {
        await persistChatSession(sessionId, userId, allMessages);
      }
    },
  });
}
