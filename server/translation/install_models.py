"""Run during setup/build, not on exam requests. Uses project-configurable XDG paths."""
from translate import translate
import argostranslate.package

REQUIRED = {'hi': '1.1', 'ar': '1.0', 'ur': '1.9'}

argostranslate.package.update_package_index()
available = argostranslate.package.get_available_packages()
for code, version in REQUIRED.items():
    installed = argostranslate.package.get_installed_packages()
    if any(p.from_code == 'en' and p.to_code == code and p.package_version == version for p in installed):
        continue
    package = next((p for p in available if p.from_code == 'en' and p.to_code == code and p.package_version == version), None)
    if package is None:
        raise RuntimeError(f'Required Argos package unavailable: en -> {code} v{version}')
    argostranslate.package.install_from_path(package.download())
    print(f'Installed en -> {code} v{version}', flush=True)

# Warm Argos and the free Marian Malayalam model so runtime assets exist before an exam is taken.
for code in REQUIRED:
    result = translate(['What is the capital of India?'], code)
    print(f'{code} warmed ({len(result[0])} chars)', flush=True)
result = translate(['What is the capital of India?'], 'ml')
print(f'ml warmed ({len(result[0])} chars)', flush=True)
