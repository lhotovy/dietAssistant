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
  validateMealPlanRecipeIds,
} from "@/lib/meal-plan-validate";
import { buildRecipeCatalogContext } from "@/lib/recipe-catalog";
import type { MealPlanDay } from "@/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const messages: UIMessage[] = body.messages ?? [];
  const sessionId: string | undefined = body.sessionId;

  const userId = await getUserId();

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: { recipe: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const favoritesContext =
    favorites.length > 0
      ? favorites
          .map((f) => {
            const name = f.customName ?? f.recipe?.name ?? "Neznámý recept";
            const idPart = f.recipeId ? ` [recipeId: ${f.recipeId}]` : "";
            const note = f.notes ? ` (poznámka: ${f.notes})` : "";
            return `- ${name}${idPart}${note}`;
          })
          .join("\n")
      : "";

  const [recipeCatalogContext, modelMessages] = await Promise.all([
    buildRecipeCatalogContext(),
    convertToModelMessages(messages),
  ]);

  const mealPlanMealSchema = z.object({
    type: z.enum(["snidane", "obed", "vecere", "svacina", "dessert"]),
    recipeId: z.string().describe("ID z katalogu receptů"),
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
      recipeCatalogContext
    ),
    messages: modelMessages,
    tools: {
      searchRecipes: tool({
        description:
          "Vyhledá recepty v databázi. Povinný krok před sestavením jídelního plánu — vrací id, name a další údaje. Použij recipeId z výsledku v JSON plánu. Můžeš volat opakovaně pro různé typy jídel (mealTypes) a dotazy.",
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
          "Předá plán aplikaci pro tlačítko Uložit. Zavolej maximálně JEDNOU po textovém plánu. Po zavolání už nic dalšího nepiš ani nevolaj další nástroje.",
        inputSchema: z.object({
          title: z.string(),
          startDate: z.string().describe("YYYY-MM-DD"),
          endDate: z.string().describe("YYYY-MM-DD"),
          days: mealPlanDaysSchema,
        }),
        execute: async ({ title, startDate, endDate, days }) => {
          const validation = await validateMealPlanRecipeIds(
            days as MealPlanDay[]
          );
          if (!validation.ok) {
            return { success: false, error: validation.error };
          }
          const enriched = await enrichMealPlanDays(days as MealPlanDay[]);
          return {
            type: "mealPlan",
            title,
            startDate,
            endDate,
            days: enriched,
          };
        },
      }),

      createRecipeInDatabase: tool({
        description:
          "Uloží nový recept do databáze tak, aby ho bylo možné příště najít.",
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
          return { success: true, recipeId: recipe.id, name };
        },
      }),
    },
    stopWhen: chatStopWhen,
    onFinish: async ({ response }) => {
      if (sessionId) {
        const allMessages = [...messages, ...response.messages];
        const existing = await prisma.chatSession.findUnique({
          where: { id: sessionId },
        });
        if (existing) {
          await prisma.chatSession.update({
            where: { id: sessionId },
            data: {
              messages: JSON.stringify(allMessages),
              updatedAt: new Date(),
            },
          });
        } else {
          const firstUserMsg = messages.find((m) => m.role === "user");
          const textPart = firstUserMsg?.parts?.find(
            (p: { type: string }) => p.type === "text"
          ) as { type: "text"; text: string } | undefined;
          const title = textPart?.text?.slice(0, 60) ?? "Nový rozhovor";
          await prisma.chatSession.create({
            data: {
              id: sessionId,
              userId,
              title,
              messages: JSON.stringify(allMessages),
            },
          });
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
