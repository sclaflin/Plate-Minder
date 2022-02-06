import YAML from 'yaml';
import fs from 'fs/promises';
import PlateMinder from './lib/PlateMinder.js';
import { DEFAULT_CONFIG } from './lib/constants.js';

(async () => {
	const config = YAML.parse(
		(await fs.readFile('config.yaml')).toString()
	) || DEFAULT_CONFIG;

	//do some cursory checks and complain
	await PlateMinder.checkEnvironment();

	PlateMinder.fromObject(config);
})();

