# 1st Sault Ste. Marie Scout Group Badge Tracker

A self-contained browser tracker for Beavers, Cubs, and Scouts.

## Open it

1. Extract the ZIP file.
2. Open `index.html` in Chrome or Edge.
3. Choose Beavers, Cubs, or Scouts.
4. Enter the section details and names.
5. Check badges and OAS stages directly in the printable preview.

## Storage

Records save automatically in the browser's local storage on that device. They are not uploaded anywhere.

Use **Export backup** to save a JSON copy. Use **Import backup** to restore or move the tracker to another device.

## Printing

Choose **Print selected section**. The print layout is letter-size landscape, with one dedicated page for every OAS stream.

- Printable monthly attendance and dues sheet generated from the selected section roster.


## Badge inventory

This version adds physical badge inventory control. Open **Badge inventory** from the header to:

- record physical stock on hand;
- set a reserve/reorder level for every badge;
- automatically see badges owed from earned tracker checkmarks;
- issue a badge to a youth (which deducts one from stock);
- receive stock or set a corrected physical count;
- review recent inventory activity and undo an issue;
- print a full inventory report; and
- print an order-only report;
- inventory dropdowns stay open while you adjust stock or target levels;
- use **Target stock for every badge** to set the desired reserve quantity across the entire badge catalog in one action;

**Available = On Hand - Owed**. **Order Qty = Owed + Reserve - On Hand**, with a minimum of zero. OAS inventory is shared across sections. Existing V2 browser data is migrated automatically because the inventory fields are added without changing the storage key. JSON backups now include inventory data.

## Inventory organization

Badge inventory is grouped into collapsible sections:

- Beaver PABs;
- Cub PABs;
- Scout PABs;
- Outdoor Adventure Skills, separated by stream; and
- progression and section awards.

The OAS streams used by this tracker are: Camping, Trail, Winter, Paddling, Aquatic, Vertical, Scoutcraft, Emergency, and Sailing. Existing OAS storage IDs are retained where applicable so browser-saved checkmarks and inventory remain compatible.
