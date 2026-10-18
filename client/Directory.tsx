import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { useData, DataStatus, Empty } from "./ui";
import type { Shelter } from "../shared/contracts";
export default function Directory() {
  const directory = useData<Shelter[]>("/shelters");
  const { data } = directory,
    container = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    [selected, setSelected] = useState("A"),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!data || !container.current) return;
    try {
      const m = L.map(container.current, { scrollWheelZoom: false }).setView(
        [28.545, -81.345],
        11,
      );
      map.current = m;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      })
        .on("tileerror", () => setFailed(true))
        .addTo(m);
      data.forEach((s) => {
        L.marker([s.lat, s.lng], {
          title: s.name,
          alt: `Demo help desk ${s.id}: ${s.name}`,
          icon: L.divIcon({
            className: "shelter-marker",
            html: `<span>${s.id}</span>`,
            iconSize: [48, 48],
            iconAnchor: [24, 48],
          }),
        })
          .addTo(m)
          .on("click", () => setSelected(s.id));
      });
      return () => {
        m.remove();
        map.current = null;
      };
    } catch {
      map.current?.remove();
      map.current = null;
      setFailed(true);
    }
  }, [data]);
  return (
    <section className="page-width app-page">
      <span className="eyebrow">START WITH A HELP DESK</span>
      <h1>A place to ask for help.</h1>
      <p className="lead">
        Three fictional participating shelters in Orange County, Florida. You do
        not have to be staying at a shelter to use its help desk.
      </p>
      <div className="notice">
        Demonstration locations only. These markers are not real emergency
        resources or people’s locations.
      </div>
      <DataStatus state={directory} />
      {data &&
        (data.length === 0 ? (
          <Empty title="No help desks available">Try again later.</Empty>
        ) : (
          <div className="directory-layout">
            <div className="shelter-list" aria-label="Help desk directory">
              {data.map((s) => (
                <button
                  className={
                    "shelter-item " + (selected === s.id ? "selected" : "")
                  }
                  key={s.id}
                  onClick={() => {
                    setSelected(s.id);
                    map.current?.panTo([s.lat, s.lng]);
                  }}
                >
                  <span className="shelter-letter">{s.id}</span>
                  <span>
                    <strong>{s.name}</strong>
                    <span>{s.address}</span>
                    <small>Fictional registration & contact assistance</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            <div className="directory-map">
              <div
                className="map"
                ref={container}
                aria-label="Interactive map of fictional help desks"
              />
              {failed && (
                <p role="status">
                  Map tiles could not load. Use the complete help-desk list
                  above the map.
                </p>
              )}
              <small>
                Drag to move · Use + and − to zoom · Select a marker or a help
                desk from the list
              </small>
            </div>
          </div>
        ))}
      <p>
        <Link to="/help">What to expect at a help desk →</Link>
      </p>
    </section>
  );
}
