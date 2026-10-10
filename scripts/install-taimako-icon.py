"""Install the user-provided TAIMAKO emblem as the Android launcher icon."""
import base64
from pathlib import Path
from PIL import Image
from io import BytesIO

asset=Path("assets/taimako-icon96.base64.txt")
raw=base64.b64decode(asset.read_text().strip(),validate=True)
logo=Image.open(BytesIO(raw)).convert("RGBA")
res=Path("android/app/src/main/res")
sizes={"mdpi":48,"hdpi":72,"xhdpi":96,"xxhdpi":144,"xxxhdpi":192}
for density,size in sizes.items():
    directory=res/("mipmap-"+density)
    directory.mkdir(parents=True,exist_ok=True)
    icon=logo.resize((size,size),Image.Resampling.LANCZOS).convert("RGB")
    for name in ("ic_launcher.png","ic_launcher_round.png","ic_launcher_foreground.png"):
        icon.save(directory/name,"PNG",optimize=True)
# Adaptive icons should use a white background, not the generic old background.
values=res/"values"
values.mkdir(parents=True,exist_ok=True)
bg=values/"tmcs_launcher_background.xml"
bg.write_text('<?xml version="1.0" encoding="utf-8"?><resources><color name="tmcs_icon_white">#FFFFFF</color></resources>\n')
for xml in res.glob("mipmap-anydpi-v*/ic_launcher*.xml"):
    data=xml.read_text()
    import re
    data=re.sub(r'android:drawable="@(?:color|drawable)/[^"]+"', 'android:drawable="@color/tmcs_icon_white"', data, count=1)
    xml.write_text(data)
print("TAIMAKO launcher icons created in five Android densities.")
