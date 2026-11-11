const port = Number(process.env.PORT || 3003);

db.authenticate()
  .then(() =>
    app.listen(port, () =>
      console.log(`Attendance: http://localhost:${port}`)
    )
  )
  .catch(e => {
    console.error('Database connection failed:', e.message);
    process.exit(1);
  });