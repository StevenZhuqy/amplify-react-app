import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import "@aws-amplify/ui-react/styles.css";
import { generateClient } from 'aws-amplify/api';
import { uploadData, getUrl, remove } from 'aws-amplify/storage'
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'
import {
  withAuthenticator,
  Button,
  Flex,
  Heading,
  Image,
  Text,
  TextField,
  View,
} from "@aws-amplify/ui-react";
import { listNotes } from "./graphql/queries";
import {
  createNote as createNoteMutation,
  deleteNote as deleteNoteMutation,
} from "./graphql/mutations";
const jwt = require('jsonwebtoken');

const client = generateClient();
const apiUrl = "https://zpdrmj2fi2.execute-api.us-east-1.amazonaws.com/";
const secret = 'shhhh';

const App = ({ signOut }) => {
  const [notes, setNotes] = useState([]);
  
  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    // const apiData = await client.graphql({ query: listNotes });
    // const notesFromAPI = apiData.data.listNotes.items;
    
    const { username } = await getCurrentUser();
    const { tokens } = await fetchAuthSession();

    const payload = {
        userId: username,
        isAdmin: tokens.accessToken.payload["cognito:groups"] && tokens.accessToken.payload["cognito:groups"].includes("Admins") || false
    };
    const token = jwt.sign(payload, secret);
    
    const response = await axios.get(`${apiUrl}/read`, {
      headers: {
        "authorization": `Bearer ${token}`,
      },
    });
    const notesFromAPI = response.data;
    await Promise.all(
      notesFromAPI.map(async (note) => {
        if (note.image) {
          const url = await getUrl({key: note.name});
          note.image = url.url.href;
        }
        return note;
      })
    );
    setNotes(notesFromAPI);
  }

  async function createNote(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const image = form.get("image");
    const { username } = await getCurrentUser();
    const data = {
      id: Date.now().toString(),
      userId: username,
      name: form.get("name"),
      description: form.get("description"),
      image: image.name,
    };
    if (!!data.image) await uploadData({key: data.name, data: image}).result;
    // await client.graphql({
    //   query: createNoteMutation,
    //   variables: { input: data },
    // });
    await axios.post(`${apiUrl}/create`, data);
    fetchNotes();
    event.target.reset();
  }

  async function deleteNote({ id, name }) {
    const { username } = await getCurrentUser();
    const { tokens } = await fetchAuthSession();

    const payload = {
      userId: username,
      isAdmin: tokens.accessToken.payload["cognito:groups"] && tokens.accessToken.payload["cognito:groups"].includes("Admins") || false
    };
    const token = jwt.sign(payload, secret);

    const response = await axios.delete(`${apiUrl}/delete`, {
      data: {
        id: id
      },
      headers: {
        "authorization": `Bearer ${token}`,
      }
    });

    if (response.status === 200) {
      const newNotes = notes.filter((note) => note.id !== id);
      setNotes(newNotes);
      await remove({key: name});
    } else {
      console.error("Error deleting note:", response.data);
    }
    // await client.graphql({
    //   query: deleteNoteMutation,
    //   variables: { input: { id } },
    // });
  }

  return (
    <View className="App">
      <Heading level={1}>My Notes App</Heading>
      <View as="form" margin="3rem 0" onSubmit={createNote}>
        <Flex direction="row" justifyContent="center">
          <TextField
            name="name"
            placeholder="Note Name"
            label="Note Name"
            labelHidden
            variation="quiet"
            required
          />
          <TextField
            name="description"
            placeholder="Note Description"
            label="Note Description"
            labelHidden
            variation="quiet"
            required
          />
          <View
            name="image"
            as="input"
            type="file"
            style={{ alignSelf: "end" }}
          />
          <Button type="submit" variation="primary">
            Create Note
          </Button>
        </Flex>
      </View>
      <Heading level={2}>Current Notes</Heading>
      <View margin="3rem 0">
        {notes.map((note) => (
          <Flex
            key={note.id || note.name}
            direction="row"
            justifyContent="center"
            alignItems="center"
          >
            <Text as="strong" fontWeight={700}>
              {note.name}
            </Text>
            <Text as="span">{note.description}</Text>
            {note.image && (
              <Image
                src={note.image}
                alt={`visual aid for ${notes.name}`}
                style={{ width: 400 }}
              />
            )}
            <Button variation="link" onClick={() => deleteNote(note)}>
              Delete note
            </Button>
          </Flex>
        ))}
      </View>
      <Button onClick={signOut}>Sign Out</Button>
    </View>
  );
};

export default withAuthenticator(App);
