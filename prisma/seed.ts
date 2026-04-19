import { PrismaClient } from "@prisma/client";
import { WOTLK_BOSSES } from "../lib/constants/bosses";

const db = new PrismaClient();

async function main() {
  console.log("Seeding bosses …");

  for (const boss of WOTLK_BOSSES) {
    await db.boss.upsert({
      where:  { slug: boss.slug },
      update: {
        name:      boss.name,
        raid:      boss.raid,
        raidSlug:  boss.raidSlug,
        wowBossId: boss.wowBossId ?? null,
        sortOrder: boss.sortOrder,
      },
      create: {
        name:      boss.name,
        slug:      boss.slug,
        raid:      boss.raid,
        raidSlug:  boss.raidSlug,
        wowBossId: boss.wowBossId ?? null,
        sortOrder: boss.sortOrder,
      },
    });
  }
  console.log(`  ✓ ${WOTLK_BOSSES.length} bosses upserted`);

  // Default realms
  const realms = [
    { name: "Lordaeron", host: "warmane",  expansion: "wotlk" },
    { name: "Icecrown",  host: "warmane",  expansion: "wotlk" },
    { name: "Frostmourne",host:"warmane",  expansion: "wotlk" },
    { name: "Retail",    host: "blizzard", expansion: "retail" },
  ];
  for (const r of realms) {
    await db.realm.upsert({
      where:  { name_host: { name: r.name, host: r.host } },
      update: {},
      create: r,
    });
  }
  console.log(`  ✓ ${realms.length} realms upserted`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
