import {
	getBaseRollupPlugins,
	getPackageJson,
	resolvePackagePath
} from './utils';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';

const { name, module, peerDependencies } = getPackageJson(
	'react-noop-renderer'
);
const pkgPath = resolvePackagePath(name);
const pkgDistPath = resolvePackagePath(name, true);

export default [
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pkgDistPath}/index.js`,
				name: 'ReactNoopRenderer',
				format: 'umd'
			}
		],
		external: [...Object.keys(peerDependencies), 'scheduler'],
		plugins: [
			...getBaseRollupPlugins({
				typescript: {
					tsconfigOverride: {
						exclude: ['./packages/react-dom/**/*'],
						compilerOptions: {
							paths: {
								hostConfig: [`./${name}/src/hostConfig.ts`]
							}
						}
					}
				}
			}),
			// webpack resolve alias
			alias({
				entries: {
					hostConfig: `${pkgPath}/src/hostConfig.ts`
				}
			}),
			generatePackageJson({
				inputFolder: pkgPath,
				outputFolder: pkgDistPath,
				baseContents: ({ name, description, version }) => ({
					name,
					description,
					version,
					peerDependencies: {
						react: version
					},
					main: 'index.js'
				})
			})
		]
	}
];
