const {
  createNodeFactory,
  generateNodeId
} = require("gatsby-node-helpers").default({
  typePrefix: "Cockpit"
});

module.exports = class SingletonItemNodeFactory {
  constructor(createNode, singletonName, images, assets, markdowns) {
    this.createNode = createNode;
    this.singletonName = singletonName;
    this.images = images;
    this.assets = assets;
    this.markdowns = markdowns;
  }

  create(singleton) {
    this.createNode(
      createNodeFactory(this.singletonName, node => {
        node.id = generateNodeId(
          this.singletonName,
          node.lang === "any"
            ? node.cockpitId
            : `${node.cockpitId}_${node.lang}`
        );
        linkImageFieldsToImageNodes(node, this.images);
        linkAssetFieldsToAssetNodes(node, this.assets);
        linkMarkdownFieldsToMarkdownNodes(node, this.markdowns);
        //linkSingletonLinkFieldsToSingletonItemNodes(node);

        return node;
      })(singleton)
    );
  }
};

const linkImageFieldsToImageNodes = (node, images) => {
  Object.keys(node).forEach(fieldName => {
    const field = node[fieldName];

    if (field.type === "image") {
      field.value___NODE = images[field.value].id;
      delete field.value;
    } else if (field.type === "gallery") {
      field.value___NODE = field.value.map(
        imageField => images[imageField.value].id
      );
      delete field.value;
    }
  });
};

const linkAssetFieldsToAssetNodes = (node, assets) => {
  Object.keys(node).forEach(fieldName => {
    const field = node[fieldName];

    if (field.type === "asset") {
      field.value___NODE = assets[field.value].id;
      delete field.value;
    }
  });
};

const linkMarkdownFieldsToMarkdownNodes = (node, markdowns) => {
  Object.keys(node).forEach(fieldName => {
    const field = node[fieldName];

    if (field.type === "markdown") {
      field.value___NODE = markdowns[field.value].id;
      delete field.value;
    }
  });
};

const linkSingletonLinkFieldsToSingletonItemNodes = node => {
  Object.keys(node).forEach(fieldName => {
    const field = node[fieldName];

    if (field.type === "singletonlink") {
      if (Array.isArray(field.value)) {
        const singletonName = field.value[0].link;

        field.value.forEach(linkedSingleton => {
          if (linkedSingleton.link !== singletonName) {
            throw new Error(
              `One to many Singleton-Links must refer to entries from a single singleton (concerned field: ${fieldName})`
            );
          }
        });

        field.value___NODE = field.value.map(linkedSingleton =>
          generateNodeId(
            linkedSingleton.link,
            node.lang === "any"
              ? linkedSingleton._id
              : `${linkedSingleton._id}_${node.lang}`
          )
        );
      } else {
        field.value___NODE = generateNodeId(
          field.value.link,
          node.lang === "any"
            ? field.value._id
            : `${field.value._id}_${node.lang}`
        );
      }

      delete field.value;
    }
  });
};
