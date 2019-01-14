const mime = require("mime");
const request = require("request-promise");

const {
	METHODS,
	MARKDOWN_IMAGE_REGEXP,
	MARKDOWN_ASSET_REGEXP
} = require("./constants");

module.exports = class CockpitService {
	constructor(baseUrl, token, locales) {
		this.baseUrl = baseUrl;
		this.token = token;
		this.locales = locales;
	}

	async fetch(endpoint, method, lang = null) {
		return request({
			uri: `${this.baseUrl}/api${endpoint}?token=${this.token}${
				lang ? `&lang=${lang}` : ""
				}`,
			method,
			json: true
		});
	}

	async validateBaseUrl() {
		try {
			await this.fetch("", METHODS.GET);
		} catch (error) {
			throw new Error(
				"BaseUrl config parameter is invalid or there is no internet connection"
			);
		}
	}

	async validateToken() {
		try {
			await this.fetch("/collections/listCollections", METHODS.GET);
		} catch (error) {
			throw new Error("Token config parameter is invalid");
		}
	}

	async getCollectionNames() {
		return this.fetch("/collections/listCollections", METHODS.GET);
	}

	async getCollection(name) {
		const { fields: collectionFields, entries } = await this.fetch(
			`/collections/get/${name}`,
			METHODS.GET
		);

		const items = entries.map(entry =>
			createCollectionItem(collectionFields, entry)
		);

		for (let index = 0; index < this.locales.length; index++) {
			const { fields: collectionFields, entries } = await this.fetch(
				`/collections/get/${name}`,
				METHODS.GET,
				this.locales[index]
			);

			items.push(
				...entries.map(entry =>
					createCollectionItem(collectionFields, entry, this.locales[index])
				)
			);
		}

		return { items, name };
	}

	async getCollections() {
		const names = await this.getCollectionNames();

		return Promise.all(names.map(name => this.getCollection(name)));
	}

	normalizeCollectionsImages(collections) {
		const images = {};

		collections.forEach(collection => {
			collection.items.forEach(item => {
				Object.keys(item)
					.filter(
						fieldName =>
							item[fieldName].type === "image" ||
							item[fieldName].type === "gallery"
					)
					.forEach(fieldName => {
						if (!Array.isArray(item[fieldName].value)) {
							const imageField = item[fieldName];
							let path = imageField.value.path;

							trimAssetField(imageField);

							if (path.startsWith("/")) {
								path = `${this.baseUrl}${path}`;
							} else if (!path.startsWith("http")) {
								path = `${this.baseUrl}/${path}`;
							}

							imageField.value = path;
							images[path] = null;
						} else {
							const galleryField = item[fieldName];

							galleryField.value.forEach(galleryImageField => {
								let path = galleryImageField.path;

								trimGalleryImageField(galleryImageField);

								if (path.startsWith("/")) {
									path = `${this.baseUrl}${path}`;
								} else {
									path = `${this.baseUrl}/${path}`;
								}

								galleryImageField.value = path;
								images[path] = null;
							});
						}
					});
			});
		});

		return images;
	}

	normalizeCollectionsAssets(collections) {
		const assets = {};

		collections.forEach(collection => {
			collection.items.forEach(item => {
				Object.keys(item)
					.filter(fieldName => item[fieldName].type === "asset")
					.forEach(fieldName => {
						const assetField = item[fieldName];
						let path = assetField.value.path;

						trimAssetField(assetField);

						path = `${this.baseUrl}/storage/uploads${path}`;

						assetField.value = path;
						assets[path] = null;
					});
			});
		});

		return assets;
	}

	normalizeCollectionsMarkdowns(collections, existingImages, existingAssets) {
		const markdowns = {};

		collections.forEach(collection => {
			collection.items.forEach(item => {
				Object.keys(item)
					.filter(fieldName => item[fieldName].type === "markdown")
					.forEach(fieldName => {
						const markdownField = item[fieldName];

						markdowns[markdownField.value] = null;
						extractImagesFromMarkdown(markdownField.value, existingImages);
						extractAssetsFromMarkdown(markdownField.value, existingAssets);
					});
			});
		});

		return markdowns;
	}







	async getSingletonNames() {
		return this.fetch("/singletons/listSingletons", METHODS.GET);
	}

	async getSingleton(name) {
		const fields = await this.fetch(
			`/singletons/get/${name}`,
			METHODS.GET
		);

		const cockpitId = name;

		var items = [];

		var keys = Object.keys(fields);
		for (var i = 0; i < keys.length; i++) {
			if (fields[keys[i]]) {
				items.push(createSingletonItem(keys[i], fields[keys[i]]));
			}
		}

		/*for (let index = 0; index < this.locales.length; index++) {
		const fields = await this.fetch(
		`/singletons/get/${name}`,
		METHODS.GET,
		this.locales[index]
		);

		var keys = Object.keys(fields);
		for (var i = 0; i < keys.length; i++) {
		items.push(createSingletonItem(keys[i], fields[keys[i]], this.locales[index]));
		}
		}*/

		return { items, name, cockpitId };
	}

	async getSingletons() {
		const names = await this.getSingletonNames();

		return Promise.all(names.map(name => this.getSingleton(name)));
	}

	normalizeSingletonsImages(singletons) {
		const images = {};

		singletons.forEach(singleton => {
			singleton.items.forEach(item => {
				//console.log(item);

				if (typeof item.field != 'undefined' && item.field == 'gallery') {
					console.log(item);
				}
				// if image
				if (typeof item.value.path != 'undefined' && item.value.path) {
					if (item.value.path.startsWith("/")) {
						item.value = `${this.baseUrl}${item.value.path}`;
					} else if (!item.value.path.startsWith("http")) {
						item.value = `${this.baseUrl}/${item.value.path}`;
					}
				} else if (typeof item.value == 'object' && Array.isArray(item.value)) {
					console.log('It is an array ' + item.field);

					for (var i = 0; i < item.value.length; i++) {
						console.log('Item' + i);
						if (typeof item.value[i].path != 'undefined' && item.value[i].path != null) {
							console.log('It has a path');
							if (item.value[i].path.startsWith("/")) {
								console.log('It starts with a /');
								item.value[i].path = `${this.baseUrl}${item.value[i].path}`;
							} else if (!item.value[i].path.startsWith("http")) {
								console.log('It does not start with a http');
								item.value[i].path = `${this.baseUrl}/${item.value[i].path}`;
							} else {
								console.log('It starts with something else');
							}
						}
					}
					item.value = JSON.stringify(item.value);
				} else {
					// if object
					if (typeof item.value == 'object') {
						item.value = JSON.stringify(item.value);
					}
				}




				/*Object.keys(item)
				.filter(
				fieldName =>
				item[fieldName].type === "image" ||
				item[fieldName].type === "gallery"
				)
				.forEach(fieldName => {
				if (!Array.isArray(item[fieldName].value)) {
				const imageField = item[fieldName];
				let path = imageField.value.path;

				trimAssetField(imageField);

				if (path.startsWith("/")) {
				path = `${this.baseUrl}${path}`;
				} else if (!path.startsWith("http")) {
				path = `${this.baseUrl}/${path}`;
				}

				imageField.value = path;
				images[path] = null;
				} else {
				const galleryField = item[fieldName];

				galleryField.value.forEach(galleryImageField => {
				let path = galleryImageField.path;

				trimGalleryImageField(galleryImageField);

				if (path.startsWith("/")) {
				path = `${this.baseUrl}${path}`;
				} else {
				path = `${this.baseUrl}/${path}`;
				}

				galleryImageField.value = path;
				images[path] = null;
				});
				}
				});*/
			});
		});

		return images;
	}

	normalizeSingletonsAssets(singletons) {
		const assets = {};

		singletons.forEach(singleton => {
			singleton.items.forEach(item => {
				Object.keys(item)
					.filter(fieldName => item[fieldName].type === "asset")
					.forEach(fieldName => {
						const assetField = item[fieldName];
						let path = assetField.value.path;

						trimAssetField(assetField);

						path = `${this.baseUrl}/storage/uploads${path}`;

						assetField.value = path;
						assets[path] = null;
					});
			});
		});

		return assets;
	}

	normalizeSingletonsMarkdowns(singletons, existingImages, existingAssets) {
		const markdowns = {};

		singletons.forEach(singleton => {
			singleton.items.forEach(item => {
				Object.keys(item)
					.filter(fieldName => item[fieldName].type === "markdown")
					.forEach(fieldName => {
						const markdownField = item[fieldName];

						markdowns[markdownField.value] = null;
						extractImagesFromMarkdown(markdownField.value, existingImages);
						extractAssetsFromMarkdown(markdownField.value, existingAssets);
					});
			});
		});

		return markdowns;
	}
};

const trimAssetField = assetField => {
	delete assetField.value._id;
	delete assetField.value.path;
	delete assetField.value.title;
	delete assetField.value.mime;
	delete assetField.value.size;
	delete assetField.value.image;
	delete assetField.value.video;
	delete assetField.value.audio;
	delete assetField.value.archive;
	delete assetField.value.document;
	delete assetField.value.code;
	delete assetField.value.created;
	delete assetField.value.modified;
	delete assetField.value._by;

	Object.keys(assetField.value).forEach(attribute => {
		assetField[attribute] = assetField.value[attribute];
		delete assetField.value[attribute];
	});
};

const trimGalleryImageField = galleryImageField => {
	galleryImageField.type = "image";

	delete galleryImageField.meta.asset;
	delete galleryImageField.path;
};

const createCollectionItem = (
	collectionFields,
	collectionEntry,
	locale = null
) => {
	const item = {
		cockpitId: collectionEntry._id,
		lang: locale == null ? "any" : locale
	};

	Object.keys(collectionFields).forEach(collectionFieldName => {
		if (
			!(
				Array.isArray(collectionEntry[collectionFieldName]) &&
				collectionEntry[collectionFieldName].length === 0
			) &&
			collectionEntry[collectionFieldName] != null
		) {
			const itemField = {
				...collectionFields[collectionFieldName],
				value: collectionEntry[collectionFieldName]
			};
			delete itemField.name;
			delete itemField.localize;
			delete itemField.options;
			item[collectionFieldName] = itemField;
		}
	});

	return item;
};

const createSingletonItem = (
	singletonField,
	singletonValue,
	locale = null
) => {
	const item = {
		lang: locale == null ? "any" : locale
	};

	if (singletonField != null && singletonField.length !== 0) {
		if (singletonValue != null && singletonValue.length !== 0) {
			item.field = singletonField;
			item.value = singletonValue;
		}
	}

	return item;
};

const extractImagesFromMarkdown = (markdown, existingImages) => {
	let unparsedMarkdown = markdown;
	let match;

	while ((match = MARKDOWN_IMAGE_REGEXP.exec(unparsedMarkdown))) {
		unparsedMarkdown = unparsedMarkdown.substring(
			match.index + match[0].length
		);
		existingImages[match[1]] = null;
	}
};

const extractAssetsFromMarkdown = (markdown, existingAssets) => {
	let unparsedMarkdown = markdown;
	let match;

	while ((match = MARKDOWN_ASSET_REGEXP.exec(unparsedMarkdown))) {
		unparsedMarkdown = unparsedMarkdown.substring(
			match.index + match[0].length
		);
		const mediaType = mime.getType(match[1]);

		if (mediaType && mediaType !== "text/html") {
			existingAssets[match[1]] = null;
		}
	}
};