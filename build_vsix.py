"""Build the VSIX manually (avoids npm/vsce, works in sandboxed environments)."""
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).parent
PKG = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))

MANIFEST = """<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="py-hover-body" Version="{version}" Publisher="local" />
    <DisplayName>Python Hover Body</DisplayName>
    <Description xml:space="preserve">{description}</Description>
    <Tags>python;hover;function;implementation</Tags>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" Version="[1.75.0,)" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" />
  </Assets>
</PackageManifest>
""".format(version=PKG["version"], description=PKG["description"])

CONTENT_TYPES = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="vsixmanifest" ContentType="text/xml" />
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="text/javascript" />
  <Default Extension="md" ContentType="text/plain" />
  <Default Extension="xml" ContentType="text/xml" />
</Types>
"""


def main() -> None:
    out = ROOT / f"py-hover-body-{PKG['version']}.vsix"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("extension.vsixmanifest", MANIFEST)
        for name in ("package.json", "extension.js", "README.md"):
            z.write(ROOT / name, f"extension/{name}")
    print(f"built: {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
