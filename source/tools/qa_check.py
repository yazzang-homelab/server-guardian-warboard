#!/usr/bin/env python3
"""QA 리포트 자동 판정 (v2.3) — qa_run.sh 가 리포트 회수 후 호출, 실패 시 비영 종료.

게이트: ① 콘솔 에러 0 (warn 은 리포트만)
       ② 전투 중 영웅 draw 누락 0 (비가시 회귀)
       ③ 마을 모닥불 코어 안 영웅 발밑 체류 0 (정지=즉시, 이동 통과=12연속 프레임 초과)
       ④ ok:false draw 0 (스프라이트 누락 회귀)
       ⑤ 생활 액션 커버리지 12/12 + 베이크 모션 9종 실출현
       ⑥ 전투 중 스프라이트 fx 재생 구간 존재
       ⑦ 처형대: 마을 프레임 p_gibbet draw ≥1 + TOP3 == 3 (v2.3)
       ⑧ 재연전투: 재연 배틀 프레임 존재 + kills/waves 델타 0 (v2.3, dq 런에서 강제)
       ⑨ DQ 무대: 3-foe 데모에서 foeL/foeR 가로 펼침 |x-240|>50 (v2.3)
       ⑩ FPS: 벽 열 ≥200(90% 프레임) + 빌보드 ≥90프레임 + 카메라 이동 ≥5셀 + win 완주 (v2.3)
사용: qa_check.py <리포트 dir>
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ACTS = ['rest', 'wood', 'lute', 'fell', 'mine', 'smelt', 'craft', 'fish', 'cook', 'herb', 'well', 'patrol']
BAKED = ['chop', 'fish', 'lute', 'cook', 'herb', 'well', 'mine', 'smelt', 'craft']
MODES = ['skirmish', 'srw', 'dq', 'fps', 'fpss', 'fpsm']
REPORT_SCHEMA = 'warboard.qa.report'
RUN_SCHEMA = 'warboard.qa.run'
FIXTURE = {
    'viewport': {'width': 1400, 'height': 900},
    'dpr': 1,
    'timezone': 'UTC',
    'browser': 'chromium-headless',
    'font': 'GalmuriPx',
    'reduced_motion': 'reduce',
}


def is_sha256(value):
    return isinstance(value, str) and re.fullmatch(r'[0-9a-f]{64}', value) is not None


def is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def load_object(path, label):
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        return None, f'{label} JSON을 읽을 수 없음: {exc}'
    if not isinstance(value, dict):
        return None, f'{label} JSON 최상위 값이 객체가 아님'
    return value, None


def manifest_fails(manifest):
    fails = []
    if manifest.get('schema') != RUN_SCHEMA or manifest.get('version') != 1:
        fails.append(f'run manifest schema/version 불일치 (기대 {RUN_SCHEMA}/1)')
    if not isinstance(manifest.get('run_id'), str) or not manifest['run_id']:
        fails.append('run manifest run_id 누락 또는 비어 있음')
    if not is_sha256(manifest.get('candidate_sha256')):
        fails.append('run manifest candidate_sha256가 64자리 소문자 SHA256이 아님')
    if manifest.get('modes') != MODES:
        fails.append(f'run manifest mode set 불일치 (기대 {", ".join(MODES)})')
    if not isinstance(manifest.get('seed'), str) or not manifest['seed']:
        fails.append('run manifest seed 누락 또는 비어 있음')
    if not is_int(manifest.get('fixed_epoch')):
        fails.append('run manifest fixed_epoch가 정수 밀리초 epoch이 아님')
    if manifest.get('fixture') != FIXTURE:
        fails.append('run manifest fixture가 고정 QA fixture와 불일치')
    if not is_int(manifest.get('started_at_ns')) or manifest['started_at_ns'] <= 0:
        fails.append('run manifest started_at_ns 누락 또는 유효하지 않음')
    return fails


def report_fails(path, rep, manifest, manifest_mtime_ns):
    mode = path.stem[len('qa-report-'):]
    fails = []
    if path.stat().st_mtime_ns < manifest_mtime_ns:
        fails.append('리포트 freshness 위반: run manifest보다 오래됨')
    if rep.get('schema') != REPORT_SCHEMA or rep.get('version') != 1:
        fails.append(f'report schema/version 불일치 (기대 {REPORT_SCHEMA}/1)')
    if rep.get('mode') != mode:
        fails.append(f"report mode 불일치: 파일={mode}, report={rep.get('mode')!r}")
    if rep.get('run_id') != manifest.get('run_id'):
        fails.append('report run_id가 run manifest와 불일치')
    if rep.get('candidate_sha256') != manifest.get('candidate_sha256') or not is_sha256(rep.get('candidate_sha256')):
        fails.append('report candidate_sha256가 run manifest와 불일치하거나 유효하지 않음')
    if rep.get('seed') != manifest.get('seed') or not isinstance(rep.get('seed'), str) or not rep.get('seed'):
        fails.append('report seed가 run manifest와 불일치하거나 비어 있음')
    if rep.get('fixed_epoch') != manifest.get('fixed_epoch') or not is_int(rep.get('fixed_epoch')):
        fails.append('report fixed_epoch가 run manifest와 불일치하거나 유효하지 않음')
    if rep.get('fixture') != FIXTURE or rep.get('fixture') != manifest.get('fixture'):
        fails.append('report fixture가 고정 QA fixture 또는 run manifest와 불일치')
    for key in ('events', 'frames', 'draws', 'shots', 'errors'):
        value = rep.get(key)
        if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
            fails.append(f'report {key}가 객체 배열이 아님')
    for draw in rep.get('draws', []) if isinstance(rep.get('draws'), list) else []:
        if not is_int(draw.get('f')) or not isinstance(draw.get('n'), str):
            fails.append('report draws 항목에 정수 f 또는 문자열 n이 없음')
            break
    for frame in rep.get('frames', []) if isinstance(rep.get('frames'), list) else []:
        if not is_int(frame.get('f')):
            fails.append('report frames 항목에 정수 f가 없음')
            break
    digest = rep.get('report_sha256')
    if not is_sha256(digest):
        fails.append('report_sha256가 64자리 소문자 SHA256이 아님')
    else:
        digest_source = dict(rep)
        del digest_source['report_sha256']
        canonical = json.dumps(digest_source, ensure_ascii=False, separators=(',', ':')).encode()
        actual = hashlib.sha256(canonical).hexdigest()
        if digest != actual:
            fails.append(f'report_sha256 불일치: report={digest}, 계산값={actual}')
    return mode, fails


def check_file(p, rep, agg):
    mode = rep['mode']
    frames = rep.get('frames', [])
    draws = rep.get('draws', [])
    errors = rep.get('errors', [])
    fails = []

    # ① 콘솔
    hard = [e for e in errors if e.get('lv') != 'warn']
    warns = [e for e in errors if e.get('lv') == 'warn']
    if hard:
        fails.append(f"콘솔 에러 {len(hard)}건: " + ' | '.join(str(e.get('m', ''))[:120] for e in hard[:3]))
    if warns:
        print(f"  [{mode}] (참고) console.warn {len(warns)}건")

    # 프레임별 draw 인덱스
    by_frame = {}
    for d in draws:
        by_frame.setdefault(d['f'], []).append(d)

    # ② 전투 영웅 비가시
    miss = 0
    for fr in frames:
        if fr.get('sc') != 'battle':
            continue
        A = fr.get('A') or {}
        h = A.get('hero')
        if not h or h.get('dead'):
            continue
        ds = by_frame.get(fr['f'], [])
        if not any(d['n'].startswith('hero_') for d in ds):
            miss += 1
    if miss:
        fails.append(f"전투 중 영웅 draw 누락 {miss}프레임")

    # ③ 모닥불 발밑 풋프린트 체류 (마을 프레임만)
    #    불 뒤/앞 '통과'는 Y-소트로 깊이 정합이라 허용 — 발밑이 불 바닥 타원 안에서
    #    비이동(run 아님) 상태거나 12연속 프레임을 초과하면 위반.
    vio = 0
    run = 0
    for fr in frames:
        if fr.get('sc') != 'village':
            run = 0
            continue
        ds = by_frame.get(fr['f'], [])
        fire = next((d for d in ds if d['n'].startswith('p_fire') and d.get('r')), None)
        hero = next((d for d in ds if d['n'].startswith('td_hero')), None)
        if not fire or not hero:
            run = 0
            continue
        rx, ry, rw, rh = fire['r']
        bx, by = rx + rw / 2, ry + rh                   # 불 발밑 중심
        ex, ey = rw * 0.45, 9.0
        hx, hy = hero['x'], hero['y']
        inside = ((hx - bx) / ex) ** 2 + ((hy - by) / ey) ** 2 < 1
        moving = hero['n'].startswith('td_hero_run')
        if inside:
            run += 1
            if (not moving) or run > 12:
                vio += 1
        else:
            run = 0
    if vio:
        fails.append(f"모닥불 발밑 체류 위반 {vio}프레임")

    # ④ 스프라이트 누락
    bad = sorted({d['n'] for d in draws if not d.get('ok')})
    if bad:
        fails.append(f"미해결 스프라이트 draw: {', '.join(bad[:8])}")

    # ⑦ 처형대 — 마을 프레임에서 p_gibbet draw(ok) + TOP3 캐시 3건
    vil = [fr for fr in frames if fr.get('sc') == 'village']
    if vil:
        gib = any(d['n'] == 'p_gibbet' and d.get('ok')
                  for fr in vil for d in by_frame.get(fr['f'], []))
        if not gib:
            fails.append("처형대 p_gibbet draw 없음")
        if not any(fr.get('t3') == 3 for fr in vil):
            fails.append("처형대 TOP3 != 3 (blips 목/캐시 회귀)")

    # ⑧ 재연전투 (이벤트 있는 런에서만 판정 — dq 런이 강제 구동)
    for e in rep.get('events', []):
        if e.get('ev') != 'replay':
            continue
        agg['replay_seen'] = True
        v = e.get('v', {})
        if v.get('w1') != v.get('w0') or v.get('k1') != v.get('k0'):
            fails.append(f"재연이 전과 오염: waves {v.get('w0')}→{v.get('w1')} kills {v.get('k0')}→{v.get('k1')}")
        if not any(fr.get('rep') for fr in frames):
            fails.append("재연 배틀 프레임 없음")

    # ⑨ DQ 무대 가로 펼침 (dq 런: 데모가 3-foe 웨이브)
    if mode == 'dq':
        spread = [fr for fr in frames if fr.get('sc') == 'battle' and fr.get('mode') == 'dq'
                  and (fr.get('A') or {}).get('foeL') and (fr.get('A') or {}).get('foeR')]
        wide = [fr for fr in spread
                if abs(fr['A']['foeL']['x'] - 240) > 50 and abs(fr['A']['foeR']['x'] - 240) > 50]
        if not wide:
            fails.append("DQ 사이드 몬스터(foeL/foeR) 가로 펼침 미검출")

    # ⑩ FPS 텔레메트리 (fps=석궁 / fpss=검·방패 / fpsm=마법 — v2.5 무기 변형 공통 게이트)
    if mode.startswith('fps'):
        fps_frames = [fr for fr in frames if fr.get('fps')]
        if not fps_frames:
            fails.append("fps 텔레메트리 프레임 없음")
        else:
            good = sum(1 for fr in fps_frames if fr['fps'].get('c', 0) >= 200)
            if good < len(fps_frames) * 0.9:
                fails.append(f"fps 벽 렌더 열 부족: {good}/{len(fps_frames)}프레임만 ≥200열")
            if sum(1 for fr in fps_frames if fr['fps'].get('s', 0) > 0) < 90:
                fails.append("fps 빌보드 표시 프레임 < 90")
            x0, y0 = fps_frames[0]['fps']['x'], fps_frames[0]['fps']['y']
            disp = max(abs(fr['fps']['x'] - x0) + abs(fr['fps']['y'] - y0) for fr in fps_frames)
            if disp < 5:
                fails.append(f"fps 카메라 이동 부족: {disp:.1f}셀 < 5")
            if not any(fr.get('res') == 'win' for fr in frames if fr.get('mode') == 'fps'):
                fails.append("fps 승리 미완주")
            want_w = {'fps': 'xbow', 'fpss': 'sword', 'fpsm': 'magic'}.get(mode)
            got_w = {fr['fps'].get('w') for fr in fps_frames}
            if want_w and want_w not in got_w:
                fails.append(f"fps 무기 불일치: 기대 {want_w}, 실측 {sorted(x for x in got_w if x)}")

    # ⑤/⑥ 집계(모드 합산)
    agg['acts'] |= {e['v'] for e in rep.get('events', []) if e.get('ev') == 'act'}
    agg['baked'] |= {a for a in BAKED for d in draws if d['n'].startswith(f'td_hero_{a}_')}
    if any(fr.get('sc') == 'battle' and fr.get('nfx', 0) > 0 for fr in frames):
        agg['fx_modes'].add(mode)
    agg['modes'].add(mode)

    return mode, fails


def main():
    if len(sys.argv) != 2:
        print('usage: qa_check.py <리포트 dir>')
        return 2
    out = Path(sys.argv[1])
    manifest_path = out / 'qa-run.json'
    manifest, error = load_object(manifest_path, 'run manifest')
    if error:
        print(f'qa_check: {error}')
        return 1
    manifest_errors = manifest_fails(manifest)
    if manifest_errors:
        print('qa_check: ★FAIL★')
        for failure in manifest_errors:
            print('  - ' + failure)
        return 1

    reports = sorted(out.glob('qa-report-*.json'))
    actual_modes = {p.stem[len('qa-report-'):] for p in reports}
    all_fails = []
    if actual_modes != set(MODES):
        all_fails.append(
            f"정확한 report mode set 위반: 기대 {', '.join(MODES)}; "
            f"실측 {', '.join(sorted(actual_modes)) or '(없음)'}"
        )

    agg = {'acts': set(), 'baked': set(), 'fx_modes': set(), 'modes': set(), 'replay_seen': False}
    manifest_mtime_ns = manifest_path.stat().st_mtime_ns
    for expected_mode in MODES:
        p = out / f'qa-report-{expected_mode}.json'
        if not p.is_file():
            continue
        rep, error = load_object(p, f'{expected_mode} report')
        if error:
            print(f'  [{expected_mode}] FAIL: {error}')
            all_fails.append(f'[{expected_mode}] {error}')
            continue
        mode, contract_fails = report_fails(p, rep, manifest, manifest_mtime_ns)
        if contract_fails:
            print(f"  [{mode}] FAIL: " + '; '.join(contract_fails))
            all_fails += [f'[{mode}] {failure}' for failure in contract_fails]
            continue
        try:
            _, fails = check_file(p, rep, agg)
        except (KeyError, TypeError, ValueError, ZeroDivisionError) as exc:
            fails = [f'리포트 payload 구조 위반으로 게이트 실행 실패: {exc}']
        status = 'OK' if not fails else 'FAIL'
        print(f"  [{mode}] {status}" + (': ' + '; '.join(fails) if fails else ''))
        all_fails += [f'[{mode}] {failure}' for failure in fails]

    missing_acts = [a for a in ACTS if a not in agg['acts']]
    if missing_acts:
        all_fails.append(f"액션 커버리지 누락: {', '.join(missing_acts)}")
    missing_baked = [a for a in BAKED if a not in agg['baked']]
    if missing_baked:
        all_fails.append(f"베이크 모션 미출현: {', '.join(missing_baked)}")
    no_fx = agg['modes'] - agg['fx_modes']
    if no_fx:
        all_fails.append(f"fx 재생 0 모드: {', '.join(sorted(no_fx))}")
    if 'dq' in agg['modes'] and not agg['replay_seen']:
        all_fails.append("재연전투 시나리오 미실행 (dq 런 강제 구동 누락)")

    print(f"  액션 {len(agg['acts'])}/12 · 베이크 {len(agg['baked'])}/9 · fx재생 {len(agg['fx_modes'])}/{len(agg['modes'])}모드")
    if all_fails:
        print("qa_check: ★FAIL★")
        for failure in all_fails:
            print("  - " + failure)
        return 1
    print("qa_check: 전 게이트 통과")
    return 0


if __name__ == '__main__':
    sys.exit(main())
