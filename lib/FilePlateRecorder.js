import PlateRecorder from './PlateRecorder.js';
import path from 'path';
import fs from 'fs/promises';
import {
	DEFAULT_IMAGE_RETAIN_DAYS,
	FILE_PLATE_RECORDER_LOG,
	FILE_PLATE_RECORDER_CLEANUP_INTERVAL,
	TOKEN_DATE,
	TOKEN_PLATE,
	TOKEN_SOURCE,
	TOKEN_TIME
} from './constants.js';

const FILE_OPERATION_INTERVAL = 100;
const FILE_OPERATION_APPEND = 'append';
const FILE_OPERATION_OVERWRITE = 'overwrite';
const FILE_OPERATION_READ = 'read';
const FILE_OPERATION_NOOP = () => {};
const FILE_OPERATIONS = [
	FILE_OPERATION_APPEND,
	FILE_OPERATION_OVERWRITE,
	FILE_OPERATION_READ
];


class FileOperation {
	#data = null;
	#operation = null;
	#callback = null;
	constructor(data, operation, callback) {
		if(FILE_OPERATIONS.indexOf(operation) === -1)
			throw new TypeError('invalid file operation.');
		if(callback && typeof callback !== 'function')
			throw new TypeError('callback must be a function.');
		
		this.#data = data;
		this.#operation = operation;
		this.#callback = callback || FILE_OPERATION_NOOP;
	}
	get data() {
		return this.#data;
	}
	get operation() {
		return this.#operation;
	}
	get callback() {
		return this.#callback;
	}
}

export default class FilePlateRecorder extends PlateRecorder {
	#pattern = null;
	#retainDays = null;
	#cleanupInterval = null;
	#writeLogTimeout = null;
	#logOperations = [];
	constructor(pattern, retainDays) {
		super();

		this.pattern = pattern;
		this.retainDays = retainDays;
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
	async start() {
		try {
			//kick off the writeLog loop
			await this.#writeLog();
			this.#cleanupInterval = setInterval(
				() => this.cleanup(),
				FILE_PLATE_RECORDER_CLEANUP_INTERVAL
			);	
		}
		catch(err) {
			console.error(err);
		}
	}
	async stop() {
		if(this.#cleanupInterval) {
			clearInterval(this.#cleanupInterval);
			this.#cleanupInterval = null;
		}
		if(this.#writeLogTimeout) {
			clearTimeout(this.#writeLogTimeout);
			this.#writeLogTimeout = null;
		}
	}
	addLogOperation(operation) {
		if(!(operation instanceof FileOperation))
			throw new TypeError('operation must be an instance of LogOperation.');
		
		this.#logOperations.push(operation);
	}
	async #writeLog() {
		for(const fileOperation of this.#logOperations) {
			this.#logOperations.shift();
			switch (fileOperation.operation) {
				case FILE_OPERATION_OVERWRITE:
					fileOperation.callback(
						await fs.writeFile(
							FILE_PLATE_RECORDER_LOG,
							`${fileOperation.data}`
						)
					);
					break;
				case FILE_OPERATION_APPEND:
					fileOperation.callback(
						await fs.appendFile(
							FILE_PLATE_RECORDER_LOG,
							`${fileOperation.data}`
						)
					);
					break;
				case FILE_OPERATION_READ:
					fileOperation.callback(
						await fs.readFile(
							FILE_PLATE_RECORDER_LOG
						)
					);
					break;
				default:
					throw new Error('Unknown file operation.');
			}
		}
		this.#writeLogTimeout = setTimeout(
			() => this.#writeLog(),
			FILE_OPERATION_INTERVAL
		);
	}
	async record(data, source, original, filtered) {
		super.record(data, source, original, filtered);
		try {
			for(const result of data.results) {
				const now = new Date();
				const date = `${now.getFullYear()}_${`0${now.getMonth() + 1}`.slice(-2)}_${`0${now.getDate()}`.slice(-2)}`;
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
				this.addLogOperation(new FileOperation(`${parts.dir}/${parts.base}|${(new Date()).getTime()}\n`, FILE_OPERATION_APPEND));
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
				this.addLogOperation(new FileOperation(
					null,
					FILE_OPERATION_READ,
					(data) => resolve(data.toString())
				));
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
			this.addLogOperation(new FileOperation(`${records.join('\n')}\n`, FILE_OPERATION_OVERWRITE));
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
				DEFAULT_IMAGE_RETAIN_DAYS
		);
	}
}
