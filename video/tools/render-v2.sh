#!/usr/bin/env bash
# Assemble the 2:55 cinematic v2 cut. Requires the ten-second cyber-defense
# opening, ElevenLabs narration, original score, subtitles, deck, and app takes.
set -euo pipefail

cd "$(dirname "$0")/.."
TAKES="takes/v2"
MOTION="takes/v4"
OUT="out/v2"
SEG="$OUT/segments"
DURATION=175
OPENING="$OUT/review/opening-v2-cyber-defense.mp4"
mkdir -p "$SEG"

for tool in ffmpeg ffprobe; do
  command -v "$tool" >/dev/null || { echo "ERROR: $tool is required" >&2; exit 1; }
done
for required in "$OPENING" "$OUT/narration.wav" "$OUT/score.wav" "$OUT/subtitles.srt"; do
  [[ -s "$required" ]] || { echo "ERROR: required final asset missing: $required" >&2; exit 1; }
done
for number in 01 02 03 04 05 06 07 08 09; do
  [[ -s "$MOTION/slide-$number.webm" ]] || { echo "ERROR: missing animated deck take: $MOTION/slide-$number.webm" >&2; exit 1; }
done
for take in map norad skirmish srw fps; do
  [[ -s "$TAKES/app-$take.webm" ]] || { echo "ERROR: missing app take: $TAKES/app-$take.webm" >&2; exit 1; }
done
[[ -s "$MOTION/app-impact-live.webm" ]] || { echo "ERROR: missing live impact take" >&2; exit 1; }

VOPT=(-c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -r 30 -an)

slide() { # slide <number> <seconds> <segment> — full 16:9 frame, object animation only
  local fade_start="$(( $2 - 1 )).60"
  ffmpeg -y -v error -ss 0.40 -i "$MOTION/slide-$1.webm" \
    -vf "scale=1920:1080:flags=lanczos,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=$2,trim=duration=$2,fade=t=in:st=0:d=0.35,fade=t=out:st=$fade_start:d=0.40,format=yuv420p" \
    "${VOPT[@]}" "$SEG/$3.mp4"
}

app() { # app <take> <seconds> <segment>
  local fade_start="$(( $2 - 1 )).65"
  ffmpeg -y -v error -ss 3 -i "$TAKES/app-$1.webm" -t "$2" \
    -vf "scale=1920:1080:flags=lanczos,setsar=1,fps=30,fade=t=in:st=0:d=0.35,fade=t=out:st=$fade_start:d=0.35,format=yuv420p" \
    "${VOPT[@]}" "$SEG/$3.mp4"
}

impact_app() { # live public counter + report badge, no crop
  local seconds="$1" fade_start="$(( $1 - 1 )).60"
  ffmpeg -y -v error -ss 1.5 -i "$MOTION/app-impact-live.webm" \
    -vf "scale=1920:1080:flags=lanczos,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=$seconds,trim=duration=$seconds,fade=t=in:st=0:d=0.35,fade=t=out:st=$fade_start:d=0.40,format=yuv420p" \
    "${VOPT[@]}" "$SEG/08_impact_live.mp4"
}

# Normalize the generated cold open and select only its primary video stream.
ffmpeg -y -v error -i "$OPENING" -map 0:v:0 -t 10 \
  -vf "scale=1920:1080:flags=lanczos,setsar=1,fps=30,fade=t=out:st=9.65:d=0.35,format=yuv420p" \
  "${VOPT[@]}" "$SEG/00_opening.mp4"

# 175 seconds. Automatic reporting receives 36 seconds:
# feature architecture (15s) + live counter/badge (12s) + impact proof (9s).
slide 01 12 01_origin
slide 02 12 02_concept
app map 17 03_map
slide 03 12 04_privacy
app norad 12 05_norad
slide 04 12 06_build
slide 06 15 07_feature
impact_app 12
app skirmish 14 09_skirmish
app srw 11 10_srw
app fps 11 11_fps
slide 07 9 12_impact_proof
slide 08 8 13_result
slide 09 8 14_close

printf '%s\n' \
  "file '00_opening.mp4'" \
  "file '01_origin.mp4'" \
  "file '02_concept.mp4'" \
  "file '03_map.mp4'" \
  "file '04_privacy.mp4'" \
  "file '05_norad.mp4'" \
  "file '06_build.mp4'" \
  "file '07_feature.mp4'" \
  "file '08_impact_live.mp4'" \
  "file '09_skirmish.mp4'" \
  "file '10_srw.mp4'" \
  "file '11_fps.mp4'" \
  "file '12_impact_proof.mp4'" \
  "file '13_result.mp4'" \
  "file '14_close.mp4'" > "$SEG/list.txt"

ffmpeg -y -v error -f concat -safe 0 -i "$SEG/list.txt" -c copy "$SEG/master-silent.mp4"

# The generated opening keeps its synchronized effects. Narration and the
# original score start after the ten-second cold open.
ffmpeg -y -v error \
  -i "$SEG/master-silent.mp4" \
  -i "$OUT/narration.wav" \
  -stream_loop -1 -i "$OUT/score.wav" \
  -i "$OPENING" \
  -filter_complex \
  "[1:a]atrim=0:165,adelay=10000:all=1,apad,atrim=0:$DURATION,volume=1[n];[2:a]atrim=0:165,adelay=10000:all=1,apad,atrim=0:$DURATION,volume=0.10[s];[3:a:0]atrim=0:10,loudnorm=I=-18:TP=-3:LRA=7,apad,atrim=0:$DURATION[o];[n][s][o]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:$DURATION[a]" \
  -vf "subtitles=$OUT/subtitles.srt:force_style='FontName=DejaVu Sans,FontSize=20,PrimaryColour=&HF4F4F4,OutlineColour=&H101010,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=48'" \
  -map 0:v:0 -map '[a]' -t "$DURATION" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart "$OUT/final.mp4"

actual="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT/final.mp4")"
whole="${actual%%.*}"
if (( whole >= 180 )); then
  echo "ERROR: final duration ${actual}s violates the sub-three-minute gate" >&2
  exit 1
fi
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,pix_fmt,r_frame_rate \
  -of default=nw=1 "$OUT/final.mp4"
echo "RENDER OK: $OUT/final.mp4 (${actual}s)"
