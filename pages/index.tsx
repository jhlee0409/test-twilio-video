import moment from "moment";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import * as Video from "twilio-video";
import styles from "../styles/Test.module.css";
import { groupBy, values } from "lodash-es";
let start: any = new Date().getTime();
let isFirst = false;
let screenTrack: any;
const localDataTrack = new Video.LocalDataTrack();
export type Nullable<T> = T | null;
export default function App() {
  const [duration, setDuration] = useState("");
  const [screenShareList, setScreenShareList] = useState([]);
  const router = useRouter();
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
    const value = chatRef.current!.value as string;
    if (!value) return;
    localDataTrack.send(JSON.stringify({ value, type: "chat" }));
    const currentTime = moment(new Date()).format("HH:mm");
    document.getElementById(
      "chatting"
    )!.innerHTML += `<p class=${styles.myChat}>${value} ${currentTime}</p>`;

    chatRef.current!.value = "";
  };

  const receiveChat = (item: any) => {
    const _item = JSON.parse(item);
    if (_item.type === "screen") {
      setScreenShareList(_item.value);
      return;
    }

    if (typeof _item.value === "number") {
      return (start = _item.value);
    }
    const currentTime = moment(new Date()).format("HH:mm");
    document.getElementById(
      "chatting"
    )!.innerHTML += `<p>${_item.value} ${currentTime}</p>`;
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
    if (!isFirst) {
      localDataTrack.send(start as any);
    }
    participant.tracks.forEach((publication) => {
      if (publication.isSubscribed) {
        const track = publication.track as Video.RemoteTrack;
        if (track.kind === "data") {
          track.on("message", (data) => receiveChat(data));
          return;
        }
        setRemoteParticipants((p) => [
          ...p,
          { id: participant.sid, participant, track },
        ]);
      }
    });
    participant.on("trackSubscribed", (track) => {
      if (track.kind === "data") {
        track.on("message", (data) => receiveChat(data));
        return;
      }
      setRemoteParticipants((p) => [
        ...p,
        { id: participant.sid, participant, track },
      ]);
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
          isFirst = room.participants.size === 0;
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
      if (!screenTrack) {
        return !e.target.checked
          ? publication.track.enable()
          : publication.track.disable();
      }
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
      if (!screenTrack) {
        return !e.target.checked
          ? publication.track.enable()
          : publication.track.disable();
      }
      if (screenTrack && !(publication.track.id === screenTrack.name)) {
        !e.target.checked
          ? publication.track.enable()
          : publication.track.disable();
      }
    });

    !e.target.checked ? localAudioTrack!.enable() : localAudioTrack!.disable();
  };

  const zoomIn = (element: HTMLElement) => {
    if (element.classList.length === 0) {
      element.classList.add(styles.zoomIn);
      return;
    } else {
      if (element.classList.contains("zoomOut")) {
        element.classList.add(styles.zoomIn);
        element.classList.remove("zoomOut");
      } else if (element.classList.contains(styles.zoomIn)) {
        element.classList.add("zoomOut");
        element.classList.remove(styles.zoomIn);
      }
    }
  };

  const mkDeviceChangeHandler = (room: Video.Room) => async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(
      (device) => device.kind === "audioinput"
    );
    if (!audioDevices[0]) return;
    const track = await Video.createLocalAudioTrack({
      deviceId: { exact: audioDevices[0].deviceId },
    });
    room.localParticipant.audioTracks.forEach((publication) => {
      publication.track.stop();
      room.localParticipant.unpublishTrack(publication.track);
    });
    room.localParticipant.publishTrack(track);
  };

  // navigator.mediaDevices.ondevicechange = mkDeviceChangeHandler(room!);

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
          div.addEventListener("click", () => zoomIn(div));
          localMediaContainer!.appendChild(div);

          localDataTrack.send(
            JSON.stringify({
              value: stream.getTracks()[0].id,
              type: "screen",
            })
          );
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
      localMediaContainer?.removeChild(screenShared);
    }
  };

  useEffect(() => {
    if (!room) return;
    console.log("room connected");
    local();
    // const timeTracker = setInterval(() => {
    //   const end = new Date().getTime();
    //   const duration = end - start;
    //   var tempTime = moment.duration(duration);
    //   const hours = tempTime.hours() === 0 ? "" : `${tempTime.hours()}시 `;
    //   const minutes =
    //     tempTime.minutes() === 0 ? "" : `${tempTime.minutes()}분 `;
    //   const seconds =
    //     tempTime.seconds() === 0 ? "" : `${tempTime.seconds()}초 `;
    //   var y = `${hours}${minutes}${seconds}지남`;
    //   console.log(y);
    //   setDuration(y);
    // }, 1000);
    return () => {
      leaveRoom();
      // clearInterval(timeTracker);
    };
  }, [room]);

  return (
    <div>
      {room === null ? (
        <div className={styles.layout}>
          <div>
            <input placeholder="방이름" ref={roomNameRef} />
            <input placeholder="유저 이름" ref={nameRef} />
            <button disabled={startConnectingRoom} onClick={joinRoom}>
              입장하기
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.room}>
          <h1>room name : {roomName}</h1>
          <h3>{duration}</h3>
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
            {values(groupBy(remoteParticipants, "id")).map((item: any[], i) => {
              return (
                <Participant
                  key={item[0].id}
                  item={item}
                  screenShareList={screenShareList}
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
  item,
  screenShareList,
}: {
  item: any[];
  screenShareList: any[];
}) => {
  return (
    <div className={styles.participant} id={item[0].participant.sid}>
      <span className={styles.identity}>{item[0].participant.identity}</span>
      {item.map((v, i) => {
        return (
          <Track
            key={v.id + i}
            track={v.track}
            screenShareList={screenShareList}
          />
        );
      })}
    </div>
  );
};

interface ITrackProps {
  track: any;
  screenShareList?: any[];
}

const Track = ({ track, screenShareList }: ITrackProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [toggle, setToggle] = useState(false);

  const zoom = () => {
    if (ref.current!.classList.contains("zoomOut")) {
      ref.current!.classList.add(styles.zoomIn);
      ref.current!.classList.remove("zoomOut");
      return;
    }
    if (ref.current!.classList.contains(styles.zoomIn)) {
      ref.current!.classList.add("zoomOut");
      ref.current!.classList.remove(styles.zoomIn);
      return;
    }
  };

  useEffect(() => {
    if (track && ref && ref.current && !ref.current.hasChildNodes()) {
      if (screenShareList && zoom) {
        if (screenShareList.includes(track.name)) {
          console.log("is screenShared");
          ref.current?.addEventListener("click", zoom);
          ref.current?.classList.add("screen-shared");
          ref.current?.classList.add("zoomOut");
        }
      }
      const child = track.attach();
      ref.current.id = track.name;
      ref.current.classList.add(track.kind);
      ref.current.appendChild(child);
    }
  }, []);
  return (
    <div
      className={`${styles.track} ${
        track.kind === "audio" ? styles.audio : ""
      }`}
      ref={ref}
    ></div>
  );
};
