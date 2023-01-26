import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import * as Video from "twilio-video";
import styles from "../styles/Test.module.css";

const localDataTrack = new Video.LocalDataTrack();
export type Nullable<T> = T | null;
export default function App() {
  const router = useRouter();
  let screenTrack: any;
  const [startConnectingRoom, setStartConnectingRoom] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] =
    useState<Video.LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] =
    useState<Video.LocalAudioTrack | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const roomNameRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLInputElement>(null);
  const [identity, setIdentify] = useState("");
  const [roomName, setRoomName] = useState("");
  const [room, setRoom] = useState<Video.Room | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<any[]>([]);

  const sendChat = () => {
    const value = chatRef.current!.value;
    if (!value) return;
    localDataTrack.send(value);
    document.getElementById(
      "chatting"
    )!.innerHTML += `<p class=${styles.myChat}>${value}</p>`;

    chatRef.current!.value = "";
  };

  const receiveChat = (value: any) => {
    document.getElementById("chatting")!.innerHTML += `<p>${value}</p>`;
  };

  const leaveRoom = () => {
    console.log("room disconnected");
    room!.disconnect();
    const localMediaContainer = document.getElementById("local-media");
    localMediaContainer?.remove();
    returnToLobby();
  };

  const addParticipant = (participant: Video.RemoteParticipant) => {
    console.log(`Participant "${participant.identity}" connected`);
    participant.tracks.forEach((publication) => {
      if (publication.isSubscribed) {
        const track = publication.track as Video.RemoteTrack;
        if (track.kind === "data") {
          track.on("message", (data) => receiveChat(data));
          return;
        }
        setRemoteParticipants((p) => [...p, { participant, track }]);
      }
    });
    participant.on("trackSubscribed", (track) => {
      if (track.kind === "data") {
        track.on("message", (data) => receiveChat(data));
        return;
      }
      setRemoteParticipants((p) => [...p, { participant, track }]);
    });
  };

  const removeParticipant = (participant: Video.RemoteParticipant) => {
    console.log(`${participant.identity} has left the room`);
    console.log("remove");
    console.log(participant.sid);
    document.getElementById(participant.sid)!.remove();
    console.log(remoteParticipants);
    setRemoteParticipants((i) =>
      i.filter((p) => p.identity !== participant.sid)
    );
  };

  const returnToLobby = () => {
    setRoom(null);
    router.reload();
  };
  const joinRoom = async () => {
    setStartConnectingRoom(true);
    try {
      const res = await fetch("/api/connectRoom", {
        method: "post",
        body: JSON.stringify({
          roomName: roomNameRef.current!.value,
          userName: nameRef.current!.value,
        }),
      }).then((res) => res.json());
      Video.createLocalTracks({
        audio: true,
        video: { width: 480 },
      })
        .then((localTracks) => {
          return Video.connect(res.token, {
            name: roomNameRef.current!.value,
            tracks: [...localTracks, localDataTrack],
            // logLevel: "debug",
          });
        })
        .then((room) => {
          setIdentify(nameRef.current!.value);
          setRoomName(roomNameRef.current!.value);
          room.participants.forEach(addParticipant);
          room.on(
            "participantConnected",
            (participant: Video.RemoteParticipant) =>
              addParticipant(participant)
          );

          room.on("participantDisconnected", removeParticipant);
          room.on("disconnected", (error) =>
            room.participants.forEach(removeParticipant)
          );
          room.on("trackUnpublished", (participant) => {
            console.log("un", participant.trackName);
            document.getElementById(participant.trackName)!.remove();
            setRemoteParticipants((i) =>
              i.filter((p) => p.identity !== participant.trackName)
            );
          });

          setRoom(room);
          console.log(`Connected to Room: ${room.name}`);
        });
    } catch (err) {
      console.log(err);
    } finally {
      setStartConnectingRoom(false);
    }
  };

  const local = async () => {
    const localMediaContainer = document.getElementById("local-media");
    const localVideoTrack = await Video.createLocalVideoTrack();
    const localAudioTrack = await Video.createLocalAudioTrack();
    setLocalVideoTrack(localVideoTrack);
    setLocalAudioTrack(localAudioTrack);
    localMediaContainer!.appendChild(localVideoTrack.attach());
  };

  const handleLocalVideoControl = (e: React.ChangeEvent<HTMLInputElement>) => {
    room!.localParticipant.videoTracks.forEach((publication) => {
      if (screenTrack && !(publication.track.id === screenTrack.name)) {
        !e.target.checked
          ? publication.track.enable()
          : publication.track.disable();
      }
    });
    !e.target.checked ? localVideoTrack!.enable() : localVideoTrack!.disable();
  };

  const handleLocalAudioControl = (e: React.ChangeEvent<HTMLInputElement>) => {
    room!.localParticipant.audioTracks.forEach((publication) => {
      if (screenTrack && !(publication.track.id === screenTrack.name)) {
        !e.target.checked
          ? publication.track.enable()
          : publication.track.disable();
      }
    });

    !e.target.checked ? localAudioTrack!.enable() : localAudioTrack!.disable();
  };

  const zoomIn = () => {
    const screenShared = document.getElementById("screen-shared")!;
    if (screenShared.classList.length === 0) {
      screenShared.classList.add(styles.zoomIn);
      return;
    } else {
      if (screenShared.classList.contains("zoomOut")) {
        screenShared.classList.add(styles.zoomIn);
        screenShared.classList.remove("zoomOut");
      } else if (screenShared.classList.contains(styles.zoomIn)) {
        screenShared.classList.add("zoomOut");
        screenShared.classList.remove(styles.zoomIn);
      }
    }
  };

  const handleScreenShare = async () => {
    if (!room) return;
    if (!screenTrack) {
      navigator.mediaDevices
        .getDisplayMedia()
        .then((stream) => {
          screenTrack = new Video.LocalVideoTrack(stream.getTracks()[0]);
          room.localParticipant.publishTrack(screenTrack);
          screenTrack.mediaStreamTrack.onended = () => {
            handleScreenShare();
          };
          const localMediaContainer = document.getElementById("screen-media");
          const div = document.createElement("div");
          console.log("stream Track", stream.getTracks()[0]);
          div.id = `screen-shared`;
          div.appendChild(screenTrack.attach());
          div.addEventListener("click", zoomIn);
          localMediaContainer!.appendChild(div);
        })
        .catch(() => {
          alert("Could not share the screen.");
        });
    } else {
      room.localParticipant.unpublishTrack(screenTrack);
      screenTrack.stop();
      screenTrack = null;
      const localMediaContainer = document.getElementById("screen-media");
      const screenShared = document.getElementById("screen-shared")!;
      console.log(localMediaContainer, screenShared);
      localMediaContainer?.removeChild(screenShared);
    }
  };

  useEffect(() => {
    if (!room) return;
    console.log("room connected");
    local();
    // return () => leaveRoom();
  }, [room]);

  return (
    <div>
      {room === null ? (
        <div className={styles.layout}>
          <div>
            <input placeholder="room name" ref={roomNameRef} />
            <input placeholder="What's your name?" ref={nameRef} />
            <button disabled={startConnectingRoom} onClick={joinRoom}>
              Join Room
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.room}>
          <h1>room name : {roomName}</h1>
          <div className={styles.wrapper}>
            <div className="participants">
              <div className={styles.participant} id={identity}>
                <button onClick={handleScreenShare}>screen share</button>
                <input type="checkbox" onChange={handleLocalVideoControl} />
                <input type="checkbox" onChange={handleLocalAudioControl} />
                <span className={styles.identity}>{identity}</span>
                <div id="local-media" className={styles.track}></div>
              </div>
              <div className={styles.participant}>
                <div id="screen-media" className={styles.track}></div>
              </div>
            </div>
            <div className={styles.chatBox}>
              <div id="chatting" className={styles.chatHistory}></div>
              <div>
                <input ref={chatRef} />
                <button onClick={sendChat} type="button">
                  send
                </button>
              </div>
            </div>
          </div>
          <div id="remote-media-div">
            remote
            {remoteParticipants.map((item, i) => {
              console.log(remoteParticipants);
              if (item.track.kind === "audio") return null;
              return (
                <Participant
                  key={item.participant.identity + i}
                  participant={item.participant}
                  track={item.track}
                />
              );
            })}
          </div>
          <button id="leaveRoom" onClick={leaveRoom}>
            Leave Room
          </button>
        </div>
      )}
    </div>
  );
}

const Participant = ({
  participant,
  track,
}: {
  participant: Video.Participant;
  track: Video.RemoteTrack;
}) => {
  useEffect(() => {
    console.log("track", track);
  }, []);
  if (track.kind === "data") return null;
  if (track.kind === "audio") return <div>오디오</div>;

  return (
    <div className={styles.participant} id={participant.sid}>
      <span className={styles.identity}>{participant.identity}</span>
      <Track key={track} track={track} />
    </div>
  );
};

const Track = ({ track }: any) => {
  const ref = useRef<HTMLDivElement>(null);
  const [toggle, setToggle] = useState(false);
  useEffect(() => {
    if (track && ref && ref.current && !ref.current.hasChildNodes()) {
      const child = track.attach();
      const a = `${track.kind} ${track.name}`;
      ref.current.id = track.name;
      ref.current.classList.add(track.kind);
      ref.current.appendChild(child);
    }
  }, []);
  return <div className={styles.track} ref={ref}></div>;
};
