const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.db_user}:${process.env.db_pass}@simple-del.4ijtj0g.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //collection
    const usersCollection = client.db("creative-design").collection("users");
    const classCollection = client.db("creative-design").collection("class");
    const cartCollection = client.db("creative-design").collection("carts");

    //--------------------------
    //     Verification JWT
    //--------------------------

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    //--------------------------
    //        API
    //--------------------------

    // users related apis
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    //user insert db
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //--------------------------
    //        admin
    //--------------------------

    // all class for admin
    app.get("/class", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    //--------------------------
    //        Instructor
    //--------------------------

    // class collection apis
    // app.get("/class", verifyJWT ,verifyInstructor, async (req, res) => {
    //   const email = req.query.email;

    //   if (!email) {
    //     res.send([]);
    //   }

    //   const decodedEmail = req.decoded.email;
    //   if (email !== decodedEmail) {
    //     return res
    //       .status(403)
    //       .send({ error: true, message: "forbidden access" });
    //   }

    //   const query = { email: email };
    //   const result = await cartCollection.find(query).toArray();
    //   res.send(result);
    // });

    // app.post("/carts", async (req, res) => {
    //   const item = req.body;
    //   const result = await cartCollection.insertOne(item);
    //   res.send(result);
    // });

    //instructor verification for dashboard
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });
    // create-class
    app.post("/create-class", verifyJWT, verifyInstructor, async (req, res) => {
      const classDetails = req.body;
      const result = await classCollection.insertOne(classDetails);
      res.send(result);
    });

    // class update details
    app.put(
      "/update-class/:id",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const id = req.params.id;
        const { name, pictureURL, subCategory, price, availableQuantity } =
          req.body.classData;

        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            name,
            pictureURL,
            subCategory,
            price,
            availableQuantity,
          },
        };
        const options = { upsert: false };

        const result = await classCollection.updateOne(filter, update, options);

        res.send(result);
      }
    );

    // all class instructor
    app.get(
      "/instructor-class",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.decoded.email;
        const query = { instructorEmail: email };
        const result = await classCollection.find(query).toArray();
        res.send(result);
      }
    );

    app.delete("/class/:id", verifyJWT, verifyInstructor, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });

    //--------------------------
    //     student api
    //--------------------------

    // cart collection apis
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body.cartItem;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //--------------------------
    //    public api all class
    //--------------------------
    app.get("/all-class", async (req, res) => {
      const result = await cartCollection.find().toArray();
      res.send(result);
    });

    app.get("/all-instructor", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/all-class", async (req, res) => {
      const email = req.body.mail;
      // get user role for  add to cart  btn show
      const emailQuery = { email: email };
      const emailResult = await usersCollection.findOne(emailQuery);
      let userCheck = null;
      if (emailResult?.role === "instructor") {
        userCheck = false;
      } else if (emailResult?.role === "admin") {
        userCheck = false;
      } else if (emailResult?.role === "student") {
        userCheck = true;
      } else if (emailResult?.role === null) {
        userCheck = true;
      }
      const query = { status: "accept" };
      const result = await classCollection.find(query).toArray();
      res.send({ result, userCheck });
    });

    //--------------------------
    //    check user role
    //--------------------------

    app.post("/check-user-role", async (req, res) => {
      const email = req.body?.email;
      if (email) {
        const emailQuery = { email: email };
        const emailResult = await usersCollection.findOne(emailQuery);
        if (emailResult) {
          res.send({ role: emailResult?.role });
        }
      } else {
        res.send({ role: null });
      }
    });

    //--------------------------
    //        api ends
    //--------------------------

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// routes
app.get("/", (req, res) => {
  res.send("simple CRUD");
});
app.listen(port, () => {
  console.log(`simple CRUD listening on ${port}`);
});
