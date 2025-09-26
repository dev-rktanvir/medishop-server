require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.Payment_Secret_Key);

// Middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f1wcz6a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // DB collections
        const usersCollection = client.db('MediShopDB').collection('users')
        const adsCollection = client.db('MediShopDB').collection('ads')
        const categoryCollection = client.db('MediShopDB').collection('category')
        const medicinesCollection = client.db('MediShopDB').collection('medicines')
        const cartItemsCollection = client.db('MediShopDB').collection('cartItems')
        const ordersCollection = client.db('MediShopDB').collection('orders')

        // Api for add user & prevent duplicate entry
        app.post('/users', async (req, res) => {
            const { email } = req.body;
            const userExist = await usersCollection.findOne({ email })

            if (userExist) {
                return res.status(200).send({ message: 'user already exists', inserted: false })
            }

            const newUser = req.body;
            const result = await usersCollection.insertOne(newUser)
            res.send(result);
        })

        // Api for user get
        app.get('/users', async (req, res) => {
            const email = req.query.email;
            const result = await usersCollection.find({ email }).toArray()
            res.send(result);
        })

        // Api for payment intant
        app.post("/create-payment-intent", async (req, res) => {
            const amount = req.body.amount;
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency: "usd",
                    payment_method_types: ["card"],
                });

                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            } catch (err) {
                res.status(500).send({ error: "Payment failed" });
            }
        });

        // Orders .............

        // Api for get all ordrs
        app.get('/orders', async (req, res) => {
            const { email, buyer, start, end } = req.query;

            const filter = {};

            if (email) {
                filter["items.seller"] = email;
            }
            if (buyer) {
                filter.buyerEmail = buyer;
            }

            if (start && end) {
                filter.$and = [
                    { createdAt: { $gte: start } },
                    { createdAt: { $lte: end + "T23:59:59.999Z" } }
                ];
            }
            const result = await ordersCollection.find(filter).toArray();
            res.send(result);
        });


        // Api for Order create
        app.post('/orders', async (req, res) => {
            const newOrder = req.body;
            const result = await ordersCollection.insertOne(newOrder)
            res.send(result);
        })

        // Api for get specific orders
        app.get('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const result = await ordersCollection.findOne({ _id: new ObjectId(id) })
            res.send(result);
        })

        // Api for patch specific order
        app.put('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const { transactionId } = req.body;
            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    paymentStatus: 'paid',
                    transId: transactionId,
                    paidAt: new Date().toISOString(),
                },
            };

            const result = await ordersCollection.updateOne(filter, updateDoc);

            res.send(result);
        });


        // Cart Items...........

        // Api for Get Cart
        app.get('/cart', async (req, res) => {
            const buyer = req.query.buyer;
            const result = await cartItemsCollection.find({ buyer }).toArray();
            res.send(result);
        })

        // Api for Add to cart
        app.post('/cart', async (req, res) => {
            const { name, buyer, company, quantity } = req.body;
            const cartItem = req.body;
            const filter = { name, buyer, company };

            const existingItem = await cartItemsCollection.findOne(filter);

            if (existingItem) {
                const updatedResult = await cartItemsCollection.updateOne(
                    filter,
                    {
                        $inc: { quantity: quantity }
                    }
                );
                res.send(updatedResult);
            }
            const result = await cartItemsCollection.insertOne(cartItem)
            res.send(result);
        })

        // Api for update cart
        app.patch('/cart/:id', async (req, res) => {
            const id = req.params.id;
            const { action } = req.body;

            const item = await cartItemsCollection.findOne({ _id: new ObjectId(id) });

            // Decrease Item
            if (action === 'decrease') {
                if (item.quantity <= 1) {
                    const result = await cartItemsCollection.deleteOne({ _id: new ObjectId(id) });
                    return res.send(result);
                } else {
                    const result = await cartItemsCollection.updateOne(
                        { _id: new ObjectId(id) },
                        { $inc: { quantity: -1 } }
                    );
                    return res.send(result);
                }
            }
            // Increase Item
            const result = await cartItemsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $inc: { quantity: 1 } }
            );
            res.send(result);
        })

        // Api for delete cart
        app.delete('/cart', async (req, res) => {
            const { id, buyer } = req.query;

            if (buyer) {
                const result = await cartItemsCollection.deleteMany({ buyer });
                return res.send(result);
            }

            const result = await cartItemsCollection.deleteOne({ _id: new ObjectId(id) })
            res.send(result);
        })

        // .............................. API For Admin .................................................

        // Api For get pending ads 
        app.get('/all-ads', async (req, res) => {
            const filter = { status: { $in: ["pending", "active"] } };
            const result = await adsCollection.find(filter).toArray();
            res.send(result);
        })

        // Api for update ads status
        app.patch('/ads/status', async (req, res) => {
            const { id, status } = req.body;

            const query = { _id: new ObjectId(id) };
            const update = { $set: { status: status } };

            const result = await adsCollection.updateOne(query, update)
            res.send(result);
        })

        // Category.....

        // Api for get category data
        app.get('/cats', async (req, res) => {
            const result = await categoryCollection.find().toArray();
            res.send(result);
        })

        // Api for add category data
        app.post('/cats', async (req, res) => {
            const newCategory = req.body;
            const result = await categoryCollection.insertOne(newCategory)
            res.send(result);
        })

        // Api for update category
        app.patch('/cats/:id', async (req, res) => {
            const id = req.params.id;
            const updatedFields = req.body;

            const query = { _id: new ObjectId(id) };
            const update = { $set: updatedFields };

            const result = await categoryCollection.updateOne(query, update)
            res.send(result);
        });

        // Api for delete category
        app.delete('/cats/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await categoryCollection.deleteOne(query);
            res.send(result);
        });

        // Medicine...........

        // Api for get medicine
        app.get('/medicine', async (req, res) => {
            const email = req.query.email;
            const filter = {};

            if (email) {
                filter.sellerEmail = email;
            }

            const result = await medicinesCollection.find(filter).toArray();
            res.send(result);
        })

        // Api for get specific category medicine
        app.get('/medicine/:name', async (req, res) => {
            const name = req.params.name;
            const result = await medicinesCollection.find({ category: name }).toArray();
            res.send(result);
        })

        // Api for add medicine
        app.post('/medicine', async (req, res) => {
            const newMedicine = req.body;
            const { category } = req.body;
            const catmedicineCount = await categoryCollection.findOne({ category_name: category })

            if (catmedicineCount) {
                await categoryCollection.updateOne(
                    { category_name: category },
                    { $inc: { medicine_Qty: 1 } }
                );
            }


            const result = await medicinesCollection.insertOne(newMedicine)
            res.send(result);
        })


        // ........................... API For Seller.....................................................

        // Api for request Advertisement
        app.post('/ads', async (req, res) => {
            const newAd = req.body;
            const result = await adsCollection.insertOne(newAd)
            res.send(result);
        })
        // Api for get Advertisment
        app.get('/ads', async (req, res) => {
            const email = req.params.email;
            const result = await adsCollection.find({ email }).toArray()
            res.send(result);
        })
        app.delete('/ads/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await adsCollection.deleteOne(query);
            res.send(result);
        })

        // ...................................... API For User ....................................



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('MediShop Server Is Running!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})