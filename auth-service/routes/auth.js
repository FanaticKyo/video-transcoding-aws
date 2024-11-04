const { CognitoIdentityProviderClient, InitiateAuthCommand, SignUpCommand, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const { getSecret } = require("../middleware/aws");
const express = require('express');
const router = express.Router();
require('dotenv').config();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const SSM = await getSecret(process.env.SECRET_NAME);
    const cognito_client_id = SSM.COGNITO_CLIENT_ID;
    // Register the user in Cognito
    const params = {
      ClientId: cognito_client_id,
      Username: username,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: req.body.email
        }
      ]
    };

    const result = await cognitoClient.send(new SignUpCommand(params));
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'An error occurred during registration' });
  }
});


router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const SSM = await getSecret(process.env.SECRET_NAME);
    const cognito_client_id = SSM.COGNITO_CLIENT_ID;
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: cognito_client_id,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    };

    const result = await cognitoClient.send(new InitiateAuthCommand(params));
    const token = result.AuthenticationResult.AccessToken;

    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred during login' });
  }
});

module.exports = router;