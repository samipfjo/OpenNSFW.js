import pathlib
import re

file_path = pathlib.Path('./dist/opennsfw.min.js').absolute()

replacements = (
    (r'^\/\*\*\n \* @license\n \* Copyright ([0-9]{4}) (.+)( All Rights Reserved\.)?\n \* Licensed under the Apache License, Version 2\.0 (.+\n){12,14} \*\/', r'/* @license Apache 2.0 - (c) \2 \1 \3 */'),
    (r'^\/\*\*\n \* @license\n \* Copyright ([0-9]{4}) (.+)\n \*\n \* Use of this source code is governed by an MIT-style\n \* license that can be found in the LICENSE file or at\n \* https://opensource.org/licenses/MIT.\n \* =============================================================================\n \*\/', r'/* @license MIT - (c) \2 \1 */'),
    (r'^\/\*\*', r'/*'),
    (r'\*\/\n"', r'*/"')
)

with open(file_path) as f:
    file_text = f.read()

for original, replace in replacements:
    file_text = re.sub(original, replace, file_text, flags=re.MULTILINE)

with open(str(file_path), 'w') as f:
    f.write(file_text)
