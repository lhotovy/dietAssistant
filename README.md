# dietAssistant

Mobilní webová aplikace pro doporučování receptů pro nízkohistaminovou dietu.

## Spuštění

```bash
npm install
npm run dev
```

Otevři [http://localhost:3000](http://localhost:3000) v prohlížeči.

## Plánování a nákup

Na stránce plánu lze uložit obecné pokyny a denní limit cukrů nebo minimum bílkovin. Pokud nastavíš číselný limit, je potřeba u použitých receptů vyplnit výživové hodnoty na porci a jejich zdroj. Generovaný plán se před uložením ověří proti limitům.

U uloženého plánu se vytváří nákupní seznam podle počtu porcí. U každé suroviny lze vyhledat aktuální kandidáty na Rohlik a ceny na veřejných stránkách Lidl. Aplikace počítá potřebný počet balení, pokud dokáže přečíst velikost balení; jinak je nutné množství ověřit ručně. Vybrané produkty lze přidat do košíku Rohlik a položky pro Lidl zkopírovat jako seznam. Volba produktu vloženého do košíku se pamatuje pro další hledání stejné suroviny. Oblíbené produkty Rohlik se zobrazují před ostatními.

### Připojení Rohlik

1. Nastav `APP_BASE_URL` na veřejný origin aplikace a `ROHLIK_TOKEN_ENCRYPTION_KEY` na náhodných 32 bajtů zakódovaných v base64 (viz `.env.example`). Klíč nikdy neukládej do Git.
2. Spusť migrace `npx prisma migrate deploy` v prostředí odpovídajícím databázi aplikace.
3. Na stránce plánu otevři nákupní seznam a klikni na **Připojit Rohlik účet**. Přihlášení proběhne na Rohlik; aplikace ukládá tokeny zašifrované na serveru a v prohlížeči drží pouze náhodný identifikátor připojení.

Rohlik může odmítnout dynamickou registraci OAuth klienta pro některé veřejné callback domény (ověřeno pro doménu nasazení `vercel.app`). V takovém případě je potřeba od Rohlik získat klienta povoleného pro přesnou adresu `APP_BASE_URL/api/rohlik/callback`. Jeho ID nastav jako `ROHLIK_OAUTH_CLIENT_ID`; pokud Rohlik vydá i klientské tajemství, nastav `ROHLIK_OAUTH_CLIENT_SECRET`. Bez schválené registrace nelze připojení na odmítnuté doméně dokončit.

Lidl lookup pokrývá veřejné stránky „Ceny v klidu“ a „Čerstvé maso“. Nejde o kompletní katalog prodejen. Ceny a dostupnost se mohou lišit podle místa a času. Aplikace nikdy sama nedokončuje objednávku Rohlik.
