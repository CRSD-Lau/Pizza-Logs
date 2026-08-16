# Third-Party Notices

Pizza Logs is independently developed and is not affiliated with or endorsed by Blizzard Entertainment, Warmane, Wowhead/ZAM, AzerothCore, Skada, or UwU Logs.

## Trademarks and Game Data

World of Warcraft, Warcraft, Wrath of the Lich King, Blizzard Entertainment, and related names and artwork are trademarks or intellectual property of their respective owners. Warmane names and services belong to their respective owner. References are descriptive and do not imply sponsorship.

The optional item metadata import reads the public AzerothCore `item_template` dataset. Review the upstream project's terms and database notices before redistributing a database export; Pizza Logs does not vendor that dataset in this repository.

Skada-WoTLK is used as a behavioral reference for combat math. UwU Logs is used as an analytical comparison reference. Pizza Logs uses independently written code and does not copy unlicensed UwU source.

## Bundled Fonts

Pizza Logs bundles the following fonts through Fontsource under the SIL Open Font License 1.1:

- Cinzel — Copyright 2020 The Cinzel Project Authors (<https://github.com/NDISCOVER/Cinzel>)
- Rajdhani — Copyright 2014 Indian Type Foundry (<https://github.com/itfoundry>)

The full license text is in [licenses/OFL-1.1.txt](licenses/OFL-1.1.txt).

## Software Dependencies

Direct dependency licenses and the reviewed transitive-license summary are recorded in [LICENSE.LIST](LICENSE.LIST). Installed dependency packages retain their upstream license files. Notable transitive runtime components include:

- Sharp/libvips platform packages under Apache-2.0, MIT, LGPL-3.0-or-later, and their bundled library licenses;
- `elkjs`, included through the Prisma CLI/Studio dependency tree, under EPL-2.0;
- `seq-queue`, included through Prisma's MySQL tooling dependency tree, under MIT (the npm metadata omits the identifier, but the package includes an MIT `LICENSE` file).

These components are distributed unmodified as dependency packages. Their inclusion does not relicense Pizza Logs source code. This notice is informational and is not legal advice.
