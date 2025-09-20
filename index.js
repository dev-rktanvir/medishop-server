require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

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

        // Category..................................

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
