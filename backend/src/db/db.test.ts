import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

describe("Database Operations", () => {
  test("can create and query database", () => {
    const db = new Database(":memory:");

    // Create test table
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT
      )
    `);

    // Insert test data
    db.run("INSERT INTO users (email, name) VALUES (?, ?)", [
      "test@example.com",
      "Test User",
    ]);

    // Query test data
    const result = db
      .query("SELECT * FROM users WHERE email = ?")
      .get("test@example.com");

    expect(result).toBeTruthy();
    expect(result?.email).toBe("test@example.com");
    expect(result?.name).toBe("Test User");

    db.close();
  });

  test("database transactions work", () => {
    const db = new Database(":memory:");

    db.run("CREATE TABLE counter (value INTEGER)");
    db.run("INSERT INTO counter VALUES (0)");

    const transaction = db.transaction(() => {
      db.run("UPDATE counter SET value = value + 1");
      db.run("UPDATE counter SET value = value + 1");
    });

    transaction();

    const result = db.query("SELECT value FROM counter").get();
    expect(result?.value).toBe(2);

    db.close();
  });

  test("can handle bulk inserts", () => {
    const db = new Database(":memory:");

    db.run(`
      CREATE TABLE emails (
        id TEXT PRIMARY KEY,
        subject TEXT,
        from_email TEXT,
        is_read INTEGER DEFAULT 0
      )
    `);

    const insert = db.prepare(
      "INSERT INTO emails (id, subject, from_email) VALUES (?, ?, ?)"
    );
    const transaction = db.transaction(() => {
      for (let i = 0; i < 100; i++) {
        insert.run([`email-${i}`, `Subject ${i}`, `sender-${i}@example.com`]);
      }
    });

    transaction();

    const result = db.query("SELECT COUNT(*) as count FROM emails").get();
    expect(result?.count).toBe(100);

    db.close();
  });

  test("can update records with conditions", () => {
    const db = new Database(":memory:");

    db.run(`
      CREATE TABLE emails (
        id TEXT PRIMARY KEY,
        subject TEXT,
        is_read INTEGER DEFAULT 0
      )
    `);

    db.run("INSERT INTO emails (id, subject, is_read) VALUES (?, ?, ?)", [
      "email1",
      "Test 1",
      0,
    ]);
    db.run("INSERT INTO emails (id, subject, is_read) VALUES (?, ?, ?)", [
      "email2",
      "Test 2",
      0,
    ]);

    // Mark as read
    db.run("UPDATE emails SET is_read = 1 WHERE id = ?", ["email1"]);

    const unread = db
      .query("SELECT COUNT(*) as count FROM emails WHERE is_read = 0")
      .get();
    expect(unread?.count).toBe(1);

    const read = db
      .query("SELECT COUNT(*) as count FROM emails WHERE is_read = 1")
      .get();
    expect(read?.count).toBe(1);

    db.close();
  });

  test("can delete records", () => {
    const db = new Database(":memory:");

    db.run(`
      CREATE TABLE emails (
        id TEXT PRIMARY KEY,
        subject TEXT
      )
    `);

    db.run("INSERT INTO emails (id, subject) VALUES (?, ?)", [
      "email1",
      "Test 1",
    ]);
    db.run("INSERT INTO emails (id, subject) VALUES (?, ?)", [
      "email2",
      "Test 2",
    ]);

    db.run("DELETE FROM emails WHERE id = ?", ["email1"]);

    const remaining = db.query("SELECT COUNT(*) as count FROM emails").get();
    expect(remaining?.count).toBe(1);

    db.close();
  });

  test("can handle concurrent operations", () => {
    const db = new Database(":memory:");

    db.run("CREATE TABLE counter (id INTEGER PRIMARY KEY, value INTEGER)");
    db.run("INSERT INTO counter VALUES (1, 0)");

    const increment = db.transaction(() => {
      const current = db.query("SELECT value FROM counter WHERE id = 1").get();
      db.run("UPDATE counter SET value = ? WHERE id = 1", [current.value + 1]);
    });

    // Simulate multiple increments
    for (let i = 0; i < 10; i++) {
      increment();
    }

    const result = db.query("SELECT value FROM counter WHERE id = 1").get();
    expect(result?.value).toBe(10);

    db.close();
  });

  test("can handle large datasets", () => {
    const db = new Database(":memory:");

    db.run(`
      CREATE TABLE emails (
        id TEXT PRIMARY KEY,
        subject TEXT,
        body TEXT,
        timestamp INTEGER
      )
    `);

    const insert = db.prepare(
      "INSERT INTO emails (id, subject, body, timestamp) VALUES (?, ?, ?, ?)"
    );

    const transaction = db.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        insert.run([
          `email-${i}`,
          `Subject ${i}`,
          `Body content for email ${i}`.repeat(10),
          Date.now() - i * 1000,
        ]);
      }
    });

    transaction();

    const result = db.query("SELECT COUNT(*) as count FROM emails").get();
    expect(result?.count).toBe(1000);

    // Test ordering
    const latest = db
      .query("SELECT * FROM emails ORDER BY timestamp DESC LIMIT 1")
      .get();
    expect(latest?.id).toBe("email-0");

    db.close();
  });

  test("database constraints work", () => {
    const db = new Database(":memory:");

    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL
      )
    `);

    db.run("INSERT INTO users (email) VALUES (?)", ["test@example.com"]);

    // Try to insert duplicate
    let threw = false;
    try {
      db.run("INSERT INTO users (email) VALUES (?)", ["test@example.com"]);
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);

    db.close();
  });
});
