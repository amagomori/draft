import { useState } from "react";
import { Home } from "./screens/Home";
import { NewPost } from "./screens/NewPost";
import { Editor } from "./screens/Editor";

export type Route = { name: "home" } | { name: "new" } | { name: "post"; id: number };

export function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  if (route.name === "new") return <NewPost navigate={setRoute} />;
  if (route.name === "post") return <Editor id={route.id} navigate={setRoute} />;
  return <Home navigate={setRoute} />;
}
