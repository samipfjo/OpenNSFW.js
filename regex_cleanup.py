import re


file_path = './dist/opennsfw.min.js'

replacements = (
    ('^\/\*\*\n \* @license\n \* Copyright ([0-9]{4}) (.+)( All Rights Reserved\.)?\n \* Licensed under the Apache License, Version 2\.0 (.+\n){12,14} \*\/', '/* @license Apache 2.0 - (c) $2 $1 $3 */'),
    ('^\/\*\*\n \* @license\n \* Copyright ([0-9]{4}) (.+)\n \*\n \* Use of this source code is governed by an MIT-style\n \* license that can be found in the LICENSE file or at\n \* https://opensource.org/licenses/MIT.\n \* =============================================================================\n \*\/', '/* @license MIT - (c) $2 $1 */'),
    ('^\/\*\*', '/*'),
    ('\*\/\n"', '*/"')
)

with open(file_path) as f:
    file_text = f.read()

for original, replace in replacements:
    re.sub()
    