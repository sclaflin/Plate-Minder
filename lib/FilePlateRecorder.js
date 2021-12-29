import PlateRecorder from './PlateRecorder.js';
import FileOperation, {
	FILE_OPERATION_APPEND,
	FILE_OPERATION_OVERWRITE,
	FILE_OPERATION_READ
} from './FileOperation.js';
import path from 'path';
import fs from 'fs/promises';
import {
	DATA_PATH,
	DEFAULT_IMAGE_RETAIN_DAYS,
	FILE_PLATE_RECORDER_LOG,
	TOKEN_DATE,
	TOKEN_PLATE,
	TOKEN_SOURCE,
	TOKEN_TIME
} from './constants.js';
import FileOperationQueue from './FileOperationQueue.js';



export default class FilePlateRecorder extends PlateRecorder {
	#pattern = null;
	#retainDays = null;
	#queue = null;
	constructor(pattern, retainDays, queue) {
		super();

		this.pattern = pattern;
		this.retainDays = retainDays;
		this.queue = queue;
	}
	get pattern() {
		return this.#pattern;
	}
	set pattern(v) {
		if(typeof v !== 'string')
			throw new TypeError('pattern must be a string.');
		if(/A-Za-z0-9_-{}]/.test(v))
			throw new TypeError('Pattern may only contain alphanumeric, "_", "-", "{", or "}".');
		//bitch about double doots
		if(/\.\./.test(v))
			throw new TypeError('Pattern may not contain double doots. Seems shady. Let\'s just take this one doot at a time.');
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
	get queue() {
		return this.#queue;
	}
	set queue(v) {
		if(!(v instanceof FileOperationQueue))
			throw new TypeError('queue must be an instance of FileOperationQueue.');
		this.#queue = v;
	}
	async record(data, source, original, filtered) {
		super.record(data, source, original, filtered);
		try {
			for(const result of data.results) {
				const now = new Date();
				const date = `${now.getFullYear()}_${`0${now.getMonth() + 1}`.slice(-2)}_${`0${now.getDate()}`.slice(-2)}`;
				const time = `${`0${now.getHours()}`.slice(-2)}_${`0${now.getMinutes()}`.slice(-2)}_${`0${now.getSeconds()}`.slice(-2)}_${`00${now.getMilliseconds()}`.slice(-3)}`;
				
				let parts = path.parse(
					`${DATA_PATH}/${
						this.pattern
							.replace(TOKEN_DATE, date)
							.replace(TOKEN_TIME, time)
							.replace(TOKEN_SOURCE, source.name)
							.replace(TOKEN_PLATE, result.plate)
					}`
				);
				
				await fs.mkdir(parts.dir, { recursive: true });
				await fs.writeFile(`${parts.dir}/${parts.base}`, await original.toJpegBuffer());
				this.queue.addOperation(
					new FileOperation(
						`${parts.dir}/${parts.base}|${(new Date()).getTime()}\n`,
						FILE_OPERATION_APPEND
					)
				);
			}
		}
		catch(err) {
			console.error(err);
		}
	}
	async cleanup() {
		try {
			const now = new Date();
			const data = (await new Promise((resolve) => {
				this.queue.addOperation(
					new FileOperation(
						null,
						FILE_OPERATION_READ,
						(data) => resolve(data.toString())
					)
				);
			}));
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
			this.queue.addOperation(
				new FileOperation(
					`${records.join('\n')}\n`,
					FILE_OPERATION_OVERWRITE
				)
			);
		}
		catch(err) {
			console.error(err);
		}
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');

		
		return new this(
			config.pattern,
			config.retainDays !== undefined ?
				config.retainDays :
				DEFAULT_IMAGE_RETAIN_DAYS,
			FileOperationQueue.fromObject({
				file: FILE_PLATE_RECORDER_LOG
			})
		);
	}
}
