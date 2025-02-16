Accounts.validateNewUser(user => {
  if (user.profile && user.profile.invalidAndThrowException)
    throw new Meteor.Error(403, "An exception thrown within Accounts.validateNewUser");
  return !(user.profile && user.profile.invalid);
});

Accounts.onCreateUser((options, user) => {
  if (options.testOnCreateUserHook) {
    user.profile = user.profile || {};
    user.profile.touchedByOnCreateUser = true;
    return user;
  } else {
    return 'TEST DEFAULT HOOK';
  }
});


// connection id -> action
const invalidateLogins = {};


Meteor.methods({
  testInvalidateLogins: function (action) {
    if (action)
      invalidateLogins[this.connection.id] = action;
    else
      delete invalidateLogins[this.connection.id];
  }
});


Accounts.validateLoginAttempt(attempt => {
  const action =
    attempt &&
    attempt.connection &&
    invalidateLogins[attempt.connection.id];

  if (! action)
    return true;
  else if (action === 'fail')
    return false;
  else if (action === 'hide')
    throw new Meteor.Error(403, 'hide actual error');
  else
    throw new Error(`unknown action: ${action}`);
});


// connection id -> [{successful: boolean, attempt: object}]
const capturedLogins = {};
let capturedLogouts = [];

Meteor.methods({
  testCaptureLogins: function () {
    capturedLogins[this.connection.id] = [];
  },

  testCaptureLogouts: () => {
    capturedLogouts = [];
  },

  testFetchCapturedLogins: function () {
    if (capturedLogins[this.connection.id]) {
      const logins = capturedLogins[this.connection.id];
      delete capturedLogins[this.connection.id];
      return logins;
    }
    else
      return [];
  },

  testFetchCapturedLogouts: () => capturedLogouts,
});

Accounts.onLogin(attempt => {
  if (!attempt.connection) // if login method called from the server
    return;

  const attemptWithoutConnection = { ...attempt };
  delete attemptWithoutConnection.connection;
  if (capturedLogins[attempt.connection.id])
    capturedLogins[attempt.connection.id].push({
      successful: true,
      attempt: attemptWithoutConnection,
    });
});

Accounts.onLoginFailure(attempt => {
  if (!attempt.connection) // if login method called from the server
    return;

  const attemptWithoutConnection = { ...attempt };
  delete attemptWithoutConnection.connection;
  if (capturedLogins[attempt.connection.id]) {
    capturedLogins[attempt.connection.id].push({
      successful: false,
      attempt: attemptWithoutConnection,
    });
  }
});

Accounts.onLogout(() => capturedLogouts.push({ successful: true }));

// Because this is global state that affects every client, we can't turn
// it on and off during the tests. Doing so would mean two simultaneous
// test runs could collide with each other.
//
// We should probably have some sort of server-isolation between
// multiple test runs. Perhaps a separate server instance per run. This
// problem isn't unique to this test, there are other places in the code
// where we do various hacky things to work around the lack of
// server-side isolation.
//
// For now, we just test the one configuration state. You can comment
// out each configuration option and see that the tests fail.
Accounts.config({
  sendVerificationEmail: true
});


Meteor.methods(
  {
    testMeteorUser:
      async () => await Meteor.userAsync(),

    clearUsernameAndProfile:
      async function () {
        if (!this.userId) throw new Error("Not logged in!");
        await Meteor
          .users
          .updateAsync(this.userId, { $unset: { profile: 1, username: 1 } });
      },

    expireTokens:
      async function () {
        await Accounts._expireTokens(new Date(), this.userId);
      },

    removeUser:
      async username => await Meteor.users.removeAsync({ "username": username }),
  }
);
