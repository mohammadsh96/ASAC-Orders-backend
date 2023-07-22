const { expect } = require('chai');
const request = require('supertest');
const { app, menuModel } = require('./index'); // Replace this with the path to your server file

describe('Server Unit Tests', function () {
  // ... (existing tests for home page, close app, and creating a new user)

  // Add more tests for other routes and functionalities here

  describe('POST /menu', function () {
    afterEach(async function () {
      // Clean up the menu items after each test
      await menuModel.deleteMany({});
    });
    it('should create a new menu item', function (done) {
        this.timeout(5000); // Set a longer timeout, e.g., 5000ms
      
        request(app)
          .post('/menu')
          .send({
            name: 'Test Menu',
          })
          .expect(201)
          .end(async function (err, res) {
            if (err) return done(err);
      
            // Verify that the menu item is created in the database
            const menuItem = await menuModel.findOne({ name: 'Test Menu' });
            expect(menuItem).to.exist;
            expect(res.body.name).to.equal('Test Menu');
            done();
          });
      });
      
      it('should create a new menu item', function (done) {
  this.timeout(5000); // Set a longer timeout, e.g., 5000ms

  request(app)
    .post('/menu')
    .send({
      name: 'Test Menu',
    })
    .expect(201)
    .end(async function (err, res) {
      if (err) return done(err);

      // Verify that the menu item is created in the database
      const menuItem = await menuModel.findOne({ name: 'Test Menu' });
      expect(menuItem).to.exist;
      expect(res.body.name).to.equal('Test Menu');
      done();
    });
});


    it('should handle missing name field', function (done) {
      request(app)
        .post('/menu')
        .send({})
        .expect(400, done); // Expecting a 400 Bad Request status
    });

    it('should handle empty name', function (done) {
      request(app)
        .post('/menu')
        .send({
          name: '',
        })
        .expect(400, done); // Expecting a 400 Bad Request status
    });

    it('should handle duplicate menu name', async function () {
      // Create a menu item with the same name before running the test
      await menuModel.create({ name: 'Duplicate Menu' });

      // Try creating a menu item with the same name again
      const res = await request(app)
        .post('/menu')
        .send({
          name: 'Duplicate Menu',
        });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal('Menu with the same name already exists');
    });

    it('should handle errors gracefully', async function () {
      // Send a request to create a menu item with an invalid body (missing 'name' field)
      const res = await request(app)
        .post('/menu')
        .send({});

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal('Name field is missing');
    });
  });

  describe('GET /menu', () => {
    it('should get all menu items', async () => {
      const response = await request(app).get('/menu');
      expect(response.status).to.be.equal(200);
      expect(Array.isArray(response.body)).to.be.true;
    });
  });

  // Add more describe blocks for testing other routes if necessary
});
