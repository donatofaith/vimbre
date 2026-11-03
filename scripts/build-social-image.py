"""Build the 1200 × 630 social card from the existing Vimbre logo."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import textwrap
im=Image.new('RGB',(1200,630),'#f5f8ff');d=ImageDraw.Draw(im)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
d.rounded_rectangle((64,48,140,124),radius=18,fill='#102a43')
logo=Image.open('public/notification-badge.png').convert('RGBA').resize((68,68),Image.Resampling.LANCZOS);im.paste(logo,(68,52),logo)
d.text((156,58),'Vimbre',font=ImageFont.truetype(bold,48),fill='#102a43')
d.text((64,182),'Declutter your work.',font=ImageFont.truetype(bold,70),fill='#102a43')
copy='Vimbre is a work continuity platform for teams. It plans your day, keeps your decisions and writes your handovers, using AI that drafts and people approve.'
for n,line in enumerate(textwrap.wrap(copy,76)):d.text((68,304+n*38),line,font=ImageFont.truetype(font,24),fill='#455b70')
d.rounded_rectangle((64,520,1136,526),radius=3,fill='#2f80ed');d.text((68,555),'Conversations · Tasks · Decisions · Handovers',font=ImageFont.truetype(font,22),fill='#102a43')
im.save('public/vimbre-work-context-og-1200.png',optimize=True)
