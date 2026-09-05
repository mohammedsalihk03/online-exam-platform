"""UTF-8 batch protocol. Argos for hi/ar/ur; Marian for ml; English fallback per item."""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault('XDG_CONFIG_HOME', str(ROOT / '.translation-config'))
os.environ.setdefault('HF_HOME', str(ROOT / '.translation-cache' / 'huggingface'))

_malayalam = None


def _log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def _argos_translator(target: str):
    import argostranslate.translate
    installed = argostranslate.translate.get_installed_languages()
    source = next((lang for lang in installed if lang.code == 'en'), None)
    destination = next((lang for lang in installed if lang.code == target), None)
    if not source or not destination:
        return None
    return source.get_translation(destination)


def _translate_argos(text: str, target: str, translator) -> str:
    script = re.compile(
        r'[\u0900-\u097f]' if target == 'hi'
        else r'[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]' if target in ('ar', 'ur')
        else r'.'
    )
    natural = bool(re.search(r'[a-zA-Z]', text)) and not text.isupper()
    candidates = [text]
    if natural and target in ('hi', 'ar', 'ur'):
        lowered = text.lower()
        if target == 'ur' and len(text.split()) == 1 and text.isalpha():
            candidates = [f'It is a {lowered}.', f'The answer is {lowered}.', lowered, text]
        else:
            candidates.extend([lowered, f'It is a {lowered}.', f'The answer is {lowered}.'])
    for candidate in candidates:
        result = translator.translate(candidate)
        if not natural or target not in ('hi', 'ar', 'ur') or script.search(result):
            return result
    return text


def _malayalam_engine():
    global _malayalam
    if _malayalam is None:
        from transformers import MarianMTModel, MarianTokenizer
        model_name = 'Helsinki-NLP/opus-mt-en-ml'
        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name)
        model.eval()
        _malayalam = (tokenizer, model)
    return _malayalam


def _clean_malayalam(text: str) -> str:
    cleaned = re.sub(r'(?:world\.?\s*kgm|zaire\d+\.?\s*kgm|\.?\s*adj\.)', '', text, flags=re.IGNORECASE).strip()
    return cleaned or text


def _translate_malayalam_raw(text: str) -> str:
    import torch
    tokenizer, model = _malayalam_engine()
    encoded = tokenizer(text, return_tensors='pt', padding=True, truncation=True, max_length=512)
    with torch.no_grad():
        generated = model.generate(**encoded, max_length=512)
    return tokenizer.decode(generated[0], skip_special_tokens=True)


def _translate_malayalam(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return text
    if '?' in stripped or len(stripped.split()) >= 4:
        return _clean_malayalam(_translate_malayalam_raw(stripped))
    direct = _clean_malayalam(_translate_malayalam_raw(stripped))
    if re.search(r'[\u0D00-\u0D7F]', direct) and not re.search(r'[A-Za-z]', direct):
        return direct
    wrapped = _clean_malayalam(_translate_malayalam_raw(f'The answer is {stripped}.'))
    if re.search(r'[\u0D00-\u0D7F]', wrapped):
        return wrapped
    return stripped


def translate_one(text: str, target: str) -> str:
    if not text or not text.strip():
        return text
    try:
        if target == 'ml':
            result = _translate_malayalam(text)
        else:
            translator = _argos_translator(target)
            if translator is None:
                raise RuntimeError(f'Missing Argos translation model: en -> {target}')
            result = _translate_argos(text, target, translator)
        if result and result.strip():
            return result
    except Exception as error:
        _log(f'Translation failed en -> {target} for {text[:120]!r}: {error}')
    return text


def translate(texts, target: str):
    return [translate_one(text, target) for text in texts]


if __name__ == '__main__':
    try:
        payload = json.load(sys.stdin)
        target = payload['target']
        texts = payload['texts']
        if not isinstance(texts, list):
            raise ValueError('texts must be an array')
        print(json.dumps({'results': translate(texts, target)}, ensure_ascii=False))
    except Exception as error:
        _log(f'Translation protocol error: {error}')
        print(json.dumps({'error': str(error)}, ensure_ascii=False))
        sys.exit(1)
