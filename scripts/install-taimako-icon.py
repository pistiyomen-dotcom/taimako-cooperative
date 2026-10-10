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
    # Full artwork has inset white space so circular launcher masks do not crop the emblem.
    def padded_icon(scale):
        canvas=Image.new("RGB",(size,size),"white")
        side=round(size*scale)
        mark=logo.resize((side,side),Image.Resampling.LANCZOS)
        canvas.paste(mark,((size-side)//2,(size-side)//2),mark)
        return canvas
    padded_icon(0.85).save(directory/"ic_launcher.png","PNG",optimize=True)
    padded_icon(0.85).save(directory/"ic_launcher_round.png","PNG",optimize=True)
    padded_icon(0.58).save(directory/"ic_launcher_foreground.png","PNG",optimize=True)
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
# Android launchers own text alignment and line-wrapping. Set the desired
# two-part label; the home-screen layout may show it on one or two lines.
strings=res/"values"/"strings.xml"
import re
if strings.exists():
    data=strings.read_text()
    if re.search(r'<string name="app_name">.*?</string>',data):
        data=re.sub(r'<string name="app_name">.*?</string>','<string name="app_name">TAIMAKO Cooperative</string>',data,count=1)
    else:
        data=data.replace("</resources>",'    <string name="app_name">TAIMAKO Cooperative</string>\\n</resources>')
    strings.write_text(data)
manifest=Path("android/app/src/main/AndroidManifest.xml")
if manifest.exists():
    data=manifest.read_text()
    if 'android:label=' in data:
        data=re.sub(r'android:label="[^"]+"','android:label="@string/app_name"',data,count=1)
        manifest.write_text(data)
print("TAIMAKO icon fitted within launcher safe area; app name updated.")
