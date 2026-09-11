{
  description = "OpenCode development flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { self, nixpkgs, ... }:
    let
      systems = [
        "aarch64-linux"
        "x86_64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
      rev = self.shortRev or self.dirtyShortRev or "dirty";
      bunVersion = nixpkgs.lib.removePrefix "bun@" (
        (builtins.fromJSON (builtins.readFile ./package.json)).packageManager
      );
      bunPackage =
        pkgs:
        pkgs.bun.overrideAttrs (
          finalAttrs: previousAttrs: {
            # Keep the shell, dependency installation, CLI and desktop on the same Bun release.
            version = bunVersion;
            src =
              finalAttrs.passthru.sources.${pkgs.stdenvNoCC.hostPlatform.system}
                or (throw "Unsupported system: ${pkgs.stdenvNoCC.hostPlatform.system}");
            passthru = previousAttrs.passthru // {
              sources = {
                "aarch64-darwin" = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-darwin-aarch64.zip";
                  hash = "sha256-kJh6OhbX21VtiGrD1VHnttPt8KHPQ6yu1iLoZ2vh0S8=";
                };
                "aarch64-linux" = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-linux-aarch64.zip";
                  hash = "sha256-VDKLvC2cjgyfiSxUTWbFeoO4QTnjSQnl7oF1jxrI/ac=";
                };
                "x86_64-darwin" = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-darwin-x64-baseline.zip";
                  hash = "sha256-utW71s8U0JgNEV9ZVMn/kE32GdXplNLaH/zNPzFjALA=";
                };
                "x86_64-linux" = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-linux-x64.zip";
                  hash = "sha256-NjaPrvdSeHXV/6UuU81IAhdB8qg+tiCKjdZAaNQiqRM=";
                };
              };
            };
          }
        );
    in
    {
      devShells = forEachSystem (pkgs: {
        default = pkgs.mkShell {
          packages = [
            (bunPackage pkgs)
            pkgs.nodejs_22
            pkgs.pkg-config
            pkgs.openssl
            pkgs.git
          ];
        };
      });

      overlays = {
        default =
          final: _prev:
          let
            bun = bunPackage final;
            node_modules = final.callPackage ./nix/node_modules.nix {
              inherit bun rev;
            };
          in
          rec {
            opencode = final.callPackage ./nix/opencode.nix {
              inherit bun node_modules;
            };
            opencode-desktop = final.callPackage ./nix/desktop.nix {
              inherit bun opencode;
            };
          };
      };

      packages = forEachSystem (
        pkgs:
        let
          bun = bunPackage pkgs;
          node_modules = pkgs.callPackage ./nix/node_modules.nix {
            inherit bun rev;
          };
        in
        rec {
          default = opencode;
          opencode = pkgs.callPackage ./nix/opencode.nix {
            inherit bun node_modules;
          };
          opencode-desktop = pkgs.callPackage ./nix/desktop.nix {
            inherit bun opencode;
          };
          # Updater derivation with fakeHash - build fails and reveals correct hash
          node_modules_updater = node_modules.override {
            hash = pkgs.lib.fakeHash;
          };
        }
      );
    };
}
