"""Démo « modèle brut » : facebook/mms-1b-all sur UN enregistrement.

Script séparé, non branché sur l'application. Il montre ce que le modèle
public donne SANS entraînement sur nos données : transcription, référence,
WER et CER.

Installation (une fois, environ 4 Go de modèle au premier lancement) :
    python3 -m venv .venv && . .venv/bin/activate
    pip install torch transformers numpy
    # ffmpeg doit être installé (sudo apt install ffmpeg)

Exemple :
    python ml/asr/mms_demo.py --audio enregistrement.webm --lang fon \
        --ref "Sɛ caki atɔɔn nǔ Koffi"

Langues : fon (Fongbé), yor (Yorùbá), fra (Français).
"""
import argparse
import re
import subprocess
import sys
import time
import unicodedata

LANGS = {"fon": "fon", "yor": "yor", "yo": "yor", "yoruba": "yor", "fr": "fra", "fra": "fra"}


def load_audio(path):
    import numpy as np

    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
        capture_output=True,
    )
    if out.returncode:
        sys.exit(f"Lecture audio impossible ({path}) : {out.stderr.decode(errors='ignore').strip()}")
    return np.frombuffer(out.stdout, np.float32)


def norm(text, strip_tones=False):
    t = unicodedata.normalize("NFC", text.lower())
    if strip_tones:
        t = "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
        t = unicodedata.normalize("NFC", t)
    t = re.sub(r"[^\w\s]", " ", t).replace("_", " ")
    return re.sub(r"\s+", " ", t).strip()


def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def rates(ref, hyp):
    rw, hw = ref.split(), hyp.split()
    wer = edit_distance(rw, hw) / max(len(rw), 1)
    cer = edit_distance(list(ref), list(hyp)) / max(len(ref), 1)
    return wer, cer


def main():
    ap = argparse.ArgumentParser(description="Transcription MMS brute sur un enregistrement")
    ap.add_argument("--audio", required=True, help="fichier audio (webm, wav, mp3...)")
    ap.add_argument("--lang", required=True, help="fon, yor ou fra")
    ap.add_argument("--ref", default="", help="phrase de référence (optionnel)")
    args = ap.parse_args()

    code = LANGS.get(args.lang.lower())
    if not code:
        sys.exit("Langue inconnue : utiliser fon, yor ou fra")

    import torch
    from transformers import AutoProcessor, Wav2Vec2ForCTC

    audio = load_audio(args.audio)
    print(f"Audio : {args.audio} ({len(audio) / 16000:.1f} s)")
    print("Chargement de facebook/mms-1b-all (sans entraînement sur nos données)...")
    t0 = time.time()
    proc = AutoProcessor.from_pretrained("facebook/mms-1b-all")
    model = Wav2Vec2ForCTC.from_pretrained("facebook/mms-1b-all", low_cpu_mem_usage=True).eval()
    proc.tokenizer.set_target_lang(code)
    model.load_adapter(code)
    t1 = time.time()
    x = proc(audio, sampling_rate=16000, return_tensors="pt")
    with torch.inference_mode():
        ids = model(**x).logits.argmax(-1)[0]
    hyp = proc.decode(ids)
    t2 = time.time()

    print()
    print(f"Langue        : {code}")
    print(f"Modèle        : {hyp}")
    if args.ref:
        print(f"Référence     : {args.ref}")
        w, c = rates(norm(args.ref), norm(hyp))
        w2, c2 = rates(norm(args.ref, True), norm(hyp, True))
        print(f"WER / CER     : {w * 100:.0f} % / {c * 100:.0f} %")
        print(f"Sans les tons : {w2 * 100:.0f} % / {c2 * 100:.0f} %")
    print(f"Temps         : chargement {t1 - t0:.0f} s, transcription {t2 - t1:.1f} s")


if __name__ == "__main__":
    main()
