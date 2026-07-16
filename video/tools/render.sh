#!/bin/bash
# Assemble the OpenAI Build Week demo video from recorded takes.
# Output: out/final.mp4 (1080p30, H.264/AAC, yuv420p, 158 s, burned EN subs).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/seg

FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
FONT_R=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
VOPT=(-c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -r 30 -an)

norm() { # norm <in.webm> <ss> <t> <out.mp4>
  ffmpeg -y -v error -ss "$2" -i "takes/$1" -t "$3" \
    -vf "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p" "${VOPT[@]}" "out/seg/$4"
}

# 1. Title card (8 s)
ffmpeg -y -v error -f lavfi -i "color=c=0x0a0e1a:s=1920x1080:d=8:r=30" -vf "\
drawtext=fontfile=$FONT:text='SERVER GUARDIAN WARBOARD':fontcolor=0xffd23b:fontsize=86:x=(w-text_w)/2:y=380,\
drawtext=fontfile=$FONT_R:text='A privacy-preserving security event viewer':fontcolor=0xe8e4d8:fontsize=40:x=(w-text_w)/2:y=520,\
drawtext=fontfile=$FONT_R:text='OpenAI Build Week - Apps for Your Life - Codex + GPT-5.6':fontcolor=0x9fb2c8:fontsize=30:x=(w-text_w)/2:y=600,\
format=yuv420p" "${VOPT[@]}" out/seg/01_title.mp4

# 2-8. Browser takes
norm s02_command_view.webm 3   22 02_command_view.mp4
norm s03_redaction.webm 4   26 03_redaction.mp4
norm s04_lang.webm      3   22 04_lang.mp4
norm s05_modes.webm     4   30 05_modes.mp4
norm s06_skirmish.webm  4   12 06_skirmish.mp4
norm s07_fps.webm       5   11 07_fps.mp4
norm s08_github.webm    1   20 08_github.mp4

# 9. End card (7 s)
ffmpeg -y -v error -f lavfi -i "color=c=0x0a0e1a:s=1920x1080:d=7:r=30" -vf "\
drawtext=fontfile=$FONT:text='Try it live':fontcolor=0xe8e4d8:fontsize=48:x=(w-text_w)/2:y=340,\
drawtext=fontfile=$FONT:text='https\\://plzhacknono.duckdns.org':fontcolor=0xffd23b:fontsize=58:x=(w-text_w)/2:y=440,\
drawtext=fontfile=$FONT_R:text='Source\\: github.com/yazzang-homelab/server-guardian-warboard':fontcolor=0x9fb2c8:fontsize=34:x=(w-text_w)/2:y=580,\
drawtext=fontfile=$FONT_R:text='Built with Codex + GPT-5.6 - OpenAI Build Week 2026':fontcolor=0x9fb2c8:fontsize=30:x=(w-text_w)/2:y=650,\
format=yuv420p" "${VOPT[@]}" out/seg/09_end.mp4

# Concat
: > out/seg/list.txt
for f in 01_title 02_command_view 03_redaction 04_lang 05_modes 06_skirmish 07_fps 08_github 09_end; do
  echo "file '$f.mp4'" >> out/seg/list.txt
done
ffmpeg -y -v error -f concat -safe 0 -i out/seg/list.txt -c copy out/seg/master_silent.mp4

# Mux narration + burn subtitles
ffmpeg -y -v error -i out/seg/master_silent.mp4 -i out/narration.wav \
  -vf "subtitles=out/subtitles.srt:force_style='FontName=DejaVu Sans,FontSize=9,PrimaryColour=&Hf0f0f0,OutlineColour=&H101010,Outline=0.7,MarginV=13'" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 160k -ac 2 -t 158 -movflags +faststart out/final.mp4

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of default=nw=1 out/final.mp4
echo "RENDER OK: out/final.mp4"
