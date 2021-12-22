import PlateRecorder from './PlateRecorder.js';
import path from 'path';
import fs from 'fs/promises';
import lockfile from 'lockfile';
import {
	DEFAULT_IMAGE_RETAIN_DAYS,
	FILE_PLATE_RECORDER_CLEANUP_INTERVAL,
	FILE_PLATE_RECORDER_LOG,
	TOKEN_DATE,
	TOKEN_PLATE,
	TOKEN_SOURCE,
	TOKEN_TIME
} from './constants.js';

export default class FilePlateRecorder extends PlateRecorder {
	#pattern = null;
	#retainDays = null;
	#interval = null;
	#lock = null;
	constructor(pattern, retainDays) {
		super();

		this.pattern = pattern;
		this.retainDays = retainDays;
		this.#interval = setInterval(
			() => this.cleanup(),
			FILE_PLATE_RECORDER_CLEANUP_INTERVAL
		);
	}
	get pattern() {
		return this.#pattern;
	}
	set pattern(v) {
		if(typeof v !== 'string')
			throw new TypeError('pattern must be a string.');
		if(/A-Za-z0-9_-{}]/.test(v))
			throw new TypeError('Pattern may only contain alphanumeric, "_", "-", "{", or "}".');
		this.#pattern = v;
	}
	get retainDays() {
		return this.#retainDays;
	}
	set retainDays(v) {
		if(!Number.isInteger(v))
			throw new TypeError('retainDays must be an integer.');
		this.#retainDays = v;
	}
	async aquireLock(file) {
		await new Promise((resolve, reject) =>
			lockfile.lock(`${file}_lock_`, err => {
				if(err) return reject(err);
				return resolve();
			})
		);
	}
	async releaseLock(file) {
		await new Promise((resolve, reject) =>
			lockfile.unlock(`${file}_lock_`, err => {
				if(err) return reject(err);
				return resolve();
			})
		);
	}
	async record(data, source, original, filtered) {
		super.record(data, source, original, filtered);

		await this.aquireLock(FILE_PLATE_RECORDER_LOG);
		for(const result of data.results) {
			const now = new Date();
			const date = `${now.getFullYear()}_${`0${now.getMonth()}`.slice(-2)}_${`0${now.getDate()}`.slice(-2)}`;
			const time = `${`0${now.getHours()}`.slice(-2)}_${`0${now.getMinutes()}`.slice(-2)}_${`0${now.getSeconds()}`.slice(-2)}_${`00${now.getMilliseconds()}`.slice(-3)}`;
			
			let parts = path.parse(
				this.pattern
					.replace(TOKEN_DATE, date)
					.replace(TOKEN_TIME, time)
					.replace(TOKEN_SOURCE, source.name)
					.replace(TOKEN_PLATE, result.plate)
			);
			
			await fs.mkdir(parts.dir, { recursive: true });
			await fs.writeFile(`${parts.dir}/${parts.base}`, await original.toJpegBuffer());
			await fs.appendFile(FILE_PLATE_RECORDER_LOG, `${parts.dir}/${parts.base}|${(new Date()).getTime()}\n`);
		}
		await this.releaseLock(FILE_PLATE_RECORDER_LOG);
	}
	async cleanup() {
		await this.aquireLock(FILE_PLATE_RECORDER_LOG);

		const now = new Date();
		const data = (await fs.readFile(FILE_PLATE_RECORDER_LOG)).toString();
		const records = [];
		for(const record of data.split('\n')) {
			if(!record) continue;
			const [filePath, date] = record.split('|');

			// Clean up expired files
			if(now > new Date(1000 * 60 * 60 * 24 * this.retainDays + parseInt(date))) {
				try { await fs.unlink(filePath); }
				catch(err) {
					console.error(`Failed to remove ${filePath}. ${err.stack}`);
				}
			}
			// Capture current files
			else records.push(record);

			// Clean up empty folders
			const pathParts = path.parse(filePath).dir.split('/');
			while(pathParts.length > 0) {
				const files = await fs.readdir(pathParts.join('/'));
				if(files.length === 0)
					await fs.rmdir(pathParts.join('/'));
				pathParts.pop();
			}
		}

		// Update the log with only current files
		await fs.writeFile(FILE_PLATE_RECORDER_LOG, records.join('\n'));

		await this.releaseLock(FILE_PLATE_RECORDER_LOG);
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');

		
		return new this(
			config.pattern,
			config.retainDays !== undefined ?
				config.retainDays :
				DEFAULT_IMAGE_RETAIN_DAYS
		);
	}
}
