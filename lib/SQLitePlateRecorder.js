import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import PlateRecorder from './PlateRecorder.js';
import { DATA_PATH, MIGRATIONS_PATH } from './constants.js';

export default class SQLitePlateRecorder extends PlateRecorder {
	#db = null;

	constructor() {
		super();

		(async() => {
			await this.init();
		})();
	}
	get db() {
		return this.#db;
	}
	async init() {
		await this.open();
		await this.migrate();
	}
	async open() {
		this.#db = await open({
			filename: `${DATA_PATH}/database.db`,
			driver: sqlite3.Database
		});
	}
	async migrate() {
		await this.#db.migrate({
			migrationsPath: MIGRATIONS_PATH
		});
	}
	async record(data, source, original, filtered) {
		super.record(data, source, original, filtered);
		
		for(const plate of data.results) {
			await this.#db.run(
				`INSERT INTO Plate (
					Number
					,EpochTime
					,ImageWidth
					,ImageHeight
					,ProcessingTime
					,Confidence
					,TopLeftX
					,TopLeftY
					,TopRightX
					,TopRightY
					,BottomRightX
					,BottomRightY
					,BottomLeftX
					,BottomLeftY
				) VALUES (
					:Number
					,:EpochTime
					,:ImageWidth
					,:ImageHeight
					,:ProcessingTime
					,:Confidence
					,:TopLeftX
					,:TopLeftY
					,:TopRightX
					,:TopRightY
					,:BottomRightX
					,:BottomRightY
					,:BottomLeftX
					,:BottomLeftY
				)
				`,
				{
					':Number': plate.plate,
					':EpochTime': data.epoch_time,
					':ImageWidth': data.img_width,
					':ImageHeight': data.img_height,
					':ProcessingTime': plate.processing_time_ms,
					':Confidence': plate.confidence,
					':TopLeftX': plate.coordinates[0].x,
					':TopLeftY': plate.coordinates[0].y,
					':TopRightX': plate.coordinates[1].x,
					':TopRightY': plate.coordinates[1].y,
					':BottomRightX': plate.coordinates[2].x,
					':BottomRightY': plate.coordinates[2].y,
					':BottomLeftX': plate.coordinates[3].x,
					':BottomLeftY': plate.coordinates[3].y
				}
			);
		}
	}
}
