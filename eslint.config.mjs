// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylistic,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- prettier doesn't provide type safe rules
    eslintConfigPrettier,
    {
        languageOptions: {
            parserOptions: {
                project: ['tsconfig.json'],
            },
        },
    },
);
