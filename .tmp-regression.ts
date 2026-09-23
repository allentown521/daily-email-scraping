import { extractProductName } from "./src/lib/email-scraper";

const expected: Record<string, string> = {
  "https://apps.apple.com/us/app/superset-100-coding-agents/id6788926383?at=1000l6eA":
    "Superset",
  "https://apps.apple.com/us/app/pome-ai-calorie-tracker/id6761577602": "Pome",
  "https://play.google.com/store/apps/details?id=com.whatsapp": "Whatsapp",
  "https://github.com/marsbos/zep?ref=producthunt": "Zep",
  "https://github.com/SPLWare/SQLazy?ref=producthunt": "SQLazy",
  "https://ustechautomations.gumroad.com/l/schemahand-offline?ref=producthunt":
    "Schemahand Offline",
  "https://www.selltostate.com/?ref=producthunt": "Sell to State",
  "https://omnidicom.com/?ref=producthunt": "OmniDICOM",
  "https://choppy-app.com/?ref=producthunt": "Choppy Pilot Logbook",
  "https://aialbumcovermaker.com/?ref=producthunt": "AI Album Cover Generator",
  "https://zvonai.ai/?ref=producthunt": "ZvonAI",
  "https://simhadigital.com/?ref=producthunt": "Simha Digital",
  "https://www.deskandpark.com/?ref=producthunt": "Desk & Park",
  "https://gatemilitia.com/?ref=producthunt": "Gate Militia",
  "https://fuzz.vc/?ref=producthunt": "FUZZ.VC",
  "https://clientsql.com/?ref=producthunt": "Client SQL",
  "https://www.growvistahospitality.com/?ref=producthunt": "GrowVista",
  "https://poloprompt.com/?ref=producthunt": "PoloPrompt",
  "https://wattai.dev/?ref=producthunt": "wattai",
  "https://radiobreak.ai/?ref=producthunt": "Radiobreak",
  "https://kinletstudio.com/?ref=producthunt": "Kinlet",
  "https://www.kyvolab.com.ng/?ref=producthunt": "KyvoLab",
  "https://niubigeo.ai/?ref=producthunt": "NiubiGEO",
  "https://check.hryp.com/?ref=producthunt": "HRYP",
  "https://unpaged.io/?ref=producthunt": "Unpaged",
  "https://caveatpro.com/?ref=producthunt": "Caveat",
  "https://www.quickmedcalc.com/?ref=producthunt": "QuickMedCalc",
  "https://wtscrm.com/?ref=producthunt": "WTS CRM",
  "https://treeremovalcostcalculator.me/?ref=producthunt":
    "Tree Removal Cost Calculator",
  "https://planningdatahub.uk/?ref=producthunt": "Planning Data Hub",
  "https://thordata.com/?ref=producthunt": "Thordata",
  "https://sharetrip.site/zh?ref=producthunt": "TripShare",
  "https://tulpatalk.com/?ref=producthunt": "Tulpa",
  "https://crecaly.com/?ref=producthunt": "Crecaly",
  "https://www.gmapsscout.com/?ref=producthunt": "GMapsScout",
  "https://forms-flow.nikaj.dev/?ref=producthunt": "Forms Flow+",
  "https://imagetoimage.org/?ref=producthunt": "Image to Image",
  "https://sf2systems.com/?ref=producthunt": "SF2 Systems",
  "https://shakenotes.com/?ref=producthunt": "ShakeNotes",
  "https://www.portfoliq.in/?ref=producthunt": "PortFoliQ",
  "https://mediascope.studio/?ref=producthunt": "MediaScope",
  "https://tickerwhale.com/?ref=producthunt": "TickerWhale",
  "https://glidenav.com/?ref=producthunt": "GlideNav",
  "https://maildoso.ai/resources/privacy-policy": "Maildoso",
  "https://saladict.cn": "Saladict",
  "https://classonline.live/login": "classonline.live",
  "https://staiola.studio/apps/commentgrab?ref=producthunt": "CommentGrab",
  "https://www.oriane.xyz/free-tools/lead-sparker?ref=producthunt": "Oriane",
  "https://www.pluxee.in/products/rewards-recognition/?ref=producthunt": "Pluxee",
  "https://www.solluz.co.in/?ref=producthunt": "Solluz",
  "https://www.dejuncrane.com/news/3-ton-portable-gantry-crane-shipped-to-israel-85580674.html?ref=producthunt":
    "Dejuncrane",
  "https://create-ebook.com/?ref=producthunt": "Create Ebook",
  "https://hyrax.dev/?ref=producthunt": "Hyrax",
  "https://okbuildpro.com/?ref=producthunt": "Okbuildpro",
  "https://www.openvc.app/accelerator-comparison/?ref=producthunt": "Openvc",
  "https://meowmood-care.huangshihtsu.chatgpt.site/?ref=producthunt":
    "Meowmood Care",
  "https://ranintelligence.github.io/ikippa-site/?ref=producthunt": "iKippa",
  "https://echo-echo-ae11.vercel.app/?ref=producthunt": "Echo Echo",
  "https://essacolor.netlify.app/en/?ref=producthunt": "EssaColor",
  "https://dropslim.app/?ref=producthunt": "DropSlim",
  "https://keepfamilysafe-familysafety.web.app/?ref=producthunt":
    "KeepFamilySafe Family Safety",
  "https://www.fantasyroad.co.uk/comicz?ref=producthunt": "Fantasy Road Comics",
  "https://appsbymo.app/margin/?ref=producthunt": "Apps by Mo",
  "https://www.sagentlab.com/navarch?ref=producthunt": "SagentLab",
  "https://spaemanhawk.com/deskflow-landing-page/?ref=producthunt":
    "Spaeman Hawk",
  "https://getconzent.com/start/": "Conzent",
  "https://www.gameplayer.site/nobrl/?ref=producthunt": "Gameplayer",
  "https://xpaiming.com/en?utm_source=producthunt": "xpaiming",
  "https://image25.photo/?ref=producthunt": "GPT Image 2.5 AI Image Generator",
  "https://glp1.app/": "Glp1",
};

const urls = Object.keys(expected);
console.log(`样本数: ${urls.length}\n`);

const CHUNK = 30;
let changed = 0;
for (let start = 0; start < urls.length; start += CHUNK) {
  const chunk = urls.slice(start, start + CHUNK);
  const results = await Promise.all(
    chunk.map(async (url) => {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        });
        const html = await res.text();
        return { url, actual: extractProductName(html, url), status: res.status };
      } catch {
        return { url, actual: extractProductName("", url), status: -1 };
      }
    }),
  );
  for (const r of results) {
    if (r.actual !== expected[r.url]) {
      changed++;
      console.log(
        `🔸 ${r.url}\n   之前 "${expected[r.url]}"  →  现在 "${r.actual}"  (${r.status})`,
      );
    }
  }
}
console.log(`\n变化: ${changed} / ${urls.length}`);
