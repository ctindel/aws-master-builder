"use strict";

const mongoose = require('mongoose');
const faker = require('faker');

const MONGO_OPTS = {
    uri: 'mongodb://localhost:27017',
    db: 'ctindel-mb3',
    options: {
        user: "ctindel",
        pass: "ctindel",
        useNewUrlParser: true,
        keepAlive: 300000,
    }
};

const NUM_ITEMS = 5;
const INTERVAL = 10; // 10 ms
const INVENTORY_START_SIZE = 20
const INVENTORY_BATCH_SIZE = 5

var productSchema = new mongoose.Schema({
    numReviews: {
        type: Number,
        get: v => Math.round(v),
        set: v => Math.round(v),
        default: 0
    },
    description: { type: String, trim:true },
    inventory: {
        type: Number,
        get: v => Math.round(v),
        set: v => Math.round(v),
        default: INVENTORY_START_SIZE
    },
},
{ collection: 'product' }
);

var ProductModel = mongoose.model('Product', productSchema);

var reviewSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId },
    reviewText: { type: String, trim:true },
    numStars: {
        type: Number,
        get: v => Math.round(v),
        set: v => Math.round(v),
        default: 0
    },
    numLikes: {
        type: Number,
        get: v => Math.round(v),
        set: v => Math.round(v),
        default: 0
    },
    numDislikes: {
        type: Number,
        get: v => Math.round(v),
        set: v => Math.round(v),
        default: 0
    },
},
{ collection: 'review' }
);

var ReviewModel = mongoose.model('Review', reviewSchema);

var orderSchema = new mongoose.Schema({
    name: { type: String, trim:true },
    address: { type: String, trim:true },
    products: {
        type: [
            {
                _id: false,
                productId: mongoose.Schema.Types.ObjectId,
                count: {
                    type: Number,
                    get: v => Math.round(v),
                    set: v => Math.round(v)
                }
            },
        ],
        default: []
    },
    orderDate: { type: Date, default: Date.now },
    status: {
        type: String,
        trim:true,
        enum: ['placed', 'approved', 'delivered'],
        default: 'placed'
    },
},
{ collection: 'order' }
);

var OrderModel = mongoose.model('Order', orderSchema);

function randomIntFromInterval(min,max) // min and max included
{
    return Math.floor(Math.random()*(max-min+1)+min);
}

const addProduct = async () => {
    console.log('ADD PRODUCT');
    await ProductModel.create(
        {
            'description' : faker.lorem.sentence()
        }
    );
}

const addProductReview = async () => {
    console.log('ADD PRODUCT REVIEW');
    // Get a random product
    var productCount = await ProductModel.countDocuments();
    var skipRecords = randomIntFromInterval(0, productCount -1);
    var product = await ProductModel.findOne().skip(skipRecords).exec();
    await ReviewModel.create(
        {
            'productId' : product._id,
            'reviewText' : faker.lorem.sentence(),
            'numStars' : randomIntFromInterval(1, 5)
        }
    );
    product.numReviews += 1
    await product.save()
}

const addProductInventory = async () => {
    console.log('ADD PRODUCT INVENTORY');
    // Get a random product
    var productCount = await ProductModel.countDocuments();
    var skipRecords = randomIntFromInterval(0, productCount -1);
    var product = await ProductModel.findOne().skip(skipRecords).exec();
    product.inventory += INVENTORY_BATCH_SIZE
    await product.save()
}
const addOrder = async () => {
    console.log('ADD ORDER');
    // First we'll get between 1 and 3 random products
    //  Then we'll order between 1 and 10 of each product
    var numProducts = randomIntFromInterval(1, 3);
    var skipRecords = randomIntFromInterval(0, numProducts-1);
    var products = await ProductModel.find().skip(skipRecords).limit(numProducts).exec();
    var order = {
        name: faker.name.findName(),
        email: faker.internet.email(),
        address:
            faker.address.streetAddress() + ', ' +
            faker.address.city() + ', ' +
            faker.address.state() + '  ' +
            faker.address.zipCode(),
        products: []
    }
    products.forEach(function addProduct(product) {
        var orderCount = randomIntFromInterval(1, 10);
        // Don't add this product to the order unless there's enough inventory
        if (orderCount <= product.inventory) {
            order.products.push({
                productId: product._id,
                count: orderCount
            });
        }
    });
    // We only want to add the order if we actually found products with inventory
    if (order.products.length > 0) {
        await OrderModel.create(order);
    }
}

const changeOrderStatus = async () => {
    // 0: Change order from 'placed' to 'approved'
    // 1: Change order from 'approved' to 'delivered'

    var randomNumber = randomIntFromInterval(0,1);
    var order = null;
    if (0 == randomNumber) {
        console.log('CHANGE ORDER STATUS FROM PLACED TO APPROVED');
        order = await OrderModel.findOne({'status' : 'placed'}).exec();
        if (order) {
            order.status = 'approved';
            await order.save();
        }
    } else if (1 == randomNumber) {
        console.log('CHANGE ORDER STATUS FROM APPROVED TO DELIVERED');
        order = await OrderModel.findOne({'status' : 'approved'}).exec();
        if (order) {
            order.status = 'delivered';
            await order.save();
        }
    }
}

const likeProductReview = async () => {
    console.log('LIKE PRODUCT REVIEW');
    // Get a random review
    var reviewCount = await ReviewModel.countDocuments();
    var skipRecords = randomIntFromInterval(0, reviewCount -1);
    var review = await ReviewModel.findOne().skip(skipRecords).exec();
    review.numLikes += 1;
    await review.save();
}

const dislikeProductReview = async () => {
    console.log('DISLIKE PRODUCT REVIEW');
    // Get a random review
    var reviewCount = await ReviewModel.countDocuments();
    var skipRecords = randomIntFromInterval(0, reviewCount -1);
    var review = await ReviewModel.findOne().skip(skipRecords).exec();
    review.numDislikes += 1;
    await review.save();
}

// This will run every second
const doAction = async() => {
    // We'll generate a random number between 0 and 10 to decide our action
    //  0: Add a product
    //  1: Add a product review
    //  2: Add an order
    //  3: Change an order status
    //  4: Add product inventory
    //  5-7: Like a product review
    //  8-10: Dislike a product review

    var randomNumber = randomIntFromInterval(0,10);
    if (0 == randomNumber) {
        await addProduct();
    } else if (1 == randomNumber) {
        await addProductReview();
    } else if (2 == randomNumber) {
        await addOrder();
    } else if (3 == randomNumber) {
        await changeOrderStatus();
    } else if (4 == randomNumber) {
        await addProductInventory();
    } else if (randomNumber >= 5 && randomNumber <= 7) {
        await likeProductReview();
    } else if (randomNumber >= 8 && randomNumber <= 10) {
        await dislikeProductReview();
    } else {
        throw new Exception("Not a valid option");
    }
    setTimeout(function() {
        doAction();
    }, INTERVAL);
}

mongoose.connect(
    MONGO_OPTS.uri + '/' + MONGO_OPTS.db, MONGO_OPTS.options,
);

doAction();
