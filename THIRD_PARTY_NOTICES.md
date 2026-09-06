# Third-Party Notices

Author: Neil Mitchell

Last modified by: Neil Mitchell

Pizza Logs is independently developed and is not affiliated with or endorsed by Blizzard Entertainment, Warmane, Wowhead/ZAM, AzerothCore, Skada, or UwU Logs.

## Trademarks and Game Data

World of Warcraft, Warcraft, Wrath of the Lich King, Blizzard Entertainment, and related names and artwork are trademarks or intellectual property of their respective owners. Warmane names and services belong to their respective owner. References are descriptive and do not imply sponsorship.

The optional item metadata import reads the public AzerothCore `item_template` dataset. Review the upstream project's terms and database notices before redistributing a database export; Pizza Logs does not vendor that dataset in this repository.

Skada-WoTLK is used as a behavioral reference for combat math. UwU Logs is used as an analytical comparison reference. Pizza Logs uses independently written code and does not copy unlicensed UwU source.

## Bundled Fonts

Pizza Logs bundles the following fonts through Fontsource under the SIL Open Font License 1.1:

- Cinzel - Copyright 2020 The Cinzel Project Authors (<https://github.com/NDISCOVER/Cinzel>)
- Rajdhani - Copyright 2014 Indian Type Foundry (<https://github.com/itfoundry>)

The full license text is in [licenses/OFL-1.1.txt](licenses/OFL-1.1.txt).
The public web distribution also includes the copyright notices and full license at
[/third-party-notices.txt](public/third-party-notices.txt).

## Remote Viewer Dependency

The character viewer loads jQuery 2.1.3 from Google's Hosted Libraries CDN.
Its [version-specific upstream license](https://github.com/jquery/jquery/blob/2.1.3/MIT-LICENSE.txt)
is MIT: Copyright 2014 jQuery Foundation and other contributors. The full notice is
also in [the public notice file](public/third-party-notices.txt). This software grant
does not license the separate Warmane viewer or Warcraft models, textures and icons.

## Generated Project Media

Neil Mitchell identifies the intro as generated with Google Veo and the social
preview as generated with ChatGPT. The [asset register](docs/security/asset-provenance.md)
records these origins, Git introduction dates and current-use limits. Pizza Logs is
not being sold or transferred. This clarification does not assign ownership of
third-party game imagery or remove ordinary usage and notice requirements.

## Software Dependencies

Direct dependency licenses and the reviewed transitive-license summary are recorded in [LICENSE.LIST](LICENSE.LIST). Installed dependency packages retain their upstream license files. Notable transitive runtime components include:

- Sharp/libvips platform packages under Apache-2.0, MIT, LGPL-3.0-or-later, and their bundled library licenses;
- `elkjs`, included through the Prisma CLI/Studio dependency tree, under EPL-2.0;
- `seq-queue`, included through Prisma's MySQL tooling dependency tree, under MIT (the npm metadata omits the identifier, but the package includes an MIT `LICENSE` file).

These components are distributed unmodified as dependency packages. Their inclusion does not relicense Pizza Logs source code. This notice is informational and is not legal advice.

Better Auth 1.7.2 is a direct runtime dependency under MIT, Copyright (c) 2024 -
present, Bereket Engida. Its installed `LICENSE.md` and the
[public notice file](public/third-party-notices.txt) retain the full grant.

Better Call 1.4.0 is a direct runtime dependency under MIT, Copyright (c) 2025 Bereket Engida. The full installed license is retained in the public notice file.
