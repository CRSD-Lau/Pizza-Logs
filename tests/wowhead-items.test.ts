import assert from "node:assert/strict";
import { parseWowheadItemPage } from "../lib/wowhead-items";

const page = `
<script>
g_items[51167].tooltip_enus = "<table><tr><td><!--nstart--><b class=\\"q4\\">Sanctified Lightsworn Headpiece<\\/b><!--nend--><span class=\\"q\\"><br>Item Level <!--ilvl-->264<\\/span><br>Binds when picked up<table width=\\"100%\\"><tr><td>Head<\\/td><th><span class=\\"q1\\">Plate<\\/span><\\/th><\\/tr><\\/table><span>2145 Armor<\\/span><br><span>+123 Stamina<\\/span><br><span>+123 Intellect<\\/span><br><a class=\\"socket-meta q0\\">Meta Socket<\\/a><br><a class=\\"socket-red q0\\">Red Socket<\\/a><br><span class=\\"q0\\">Socket Bonus: +9 Spell Power<\\/span><br>Durability 100 \\/ 100<\\/td><\\/tr><\\/table>";
$.extend(g_items[51167], {"id":51167,"level":264,"name":"Sanctified Lightsworn Headpiece","quality":4,"slot":1,"jsonequip":{"slotbak":1}});
WH.Gatherer.addData(3, 8, {"51167":{"name_enus":"Sanctified Lightsworn Headpiece","quality":4,"icon":"inv_helmet_154","jsonequip":{"slotbak":1}}});
</script>`;

const parsed = parseWowheadItemPage(51167, page);

assert.deepEqual(parsed, {
  itemId: "51167",
  name: "Sanctified Lightsworn Headpiece",
  quality: "epic",
  itemLevel: 264,
  iconUrl: "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_154.jpg",
  itemUrl: "https://www.wowhead.com/wotlk/item=51167/sanctified-lightsworn-headpiece",
  equipLoc: "INVTYPE_HEAD",
  details: [
    "Sanctified Lightsworn Headpiece",
    "Item Level 264",
    "Binds when picked up Head Plate",
    "2145 Armor",
    "+123 Stamina",
    "+123 Intellect",
    "Meta Socket",
    "Red Socket",
    "Socket Bonus: +9 Spell Power",
    "Durability 100 / 100",
  ],
});

console.log("wowhead-items tests passed");
