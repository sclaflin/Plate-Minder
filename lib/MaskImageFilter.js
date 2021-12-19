import fs from 'fs/promises';
import ImageFilter from './ImageFilter.js';
import cv from './OpenCV.js'

export default class MaskImageFilter extends ImageFilter {
	#shapes = [];
	async next(rawImage) {
		super.next(rawImage);
		
		const img = rawImage.toMat();
		for(const shape of this.shapes) {
			const pointCount = shape.length / 2;
			const shapePoints = cv.matFromArray(pointCount, 1, cv.CV_32SC2, shape);
			const points = new cv.MatVector();
			const color = new cv.Scalar(0, 0, 0);
			
			points.push_back(shapePoints);
			cv.fillPoly(img, points, color);

			shapePoints.delete();
			points.delete();
		}
		rawImage.loadMat(img);
		img.delete();
	}
	get shapes() {
		return this.#shapes.slice(0);
	}
	set shapes(v) {
		if(!Array.isArray(v))
			throw new TypeError('shapes must be an Array.');
		if(v.filter(v => !(v instanceof Uint16Array)).length > 0)
			throw new TypeError('Each shape must be a Uint16Array.')
		
		for(const shape of v) {
			if(shape.filter(v => !Number.isInteger(v)).length > 0)
				throw new TypeError('All values of shape must be an integer between 0 and 65,535.');
			if(shape.length % 2 === 1)
				throw new TypeError('Total number of values in a shape must be an even number.');
		}
		
		this.#shapes.length = 0;
		this.#shapes.push(...v);
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');

		const filter = new this();
		filter.shapes = (config.shapes || [])
			.map(v =>
				new Uint16Array(
					v.split(',').map(v => parseInt(v, 10))
				)
			);
		return filter;
	}
}