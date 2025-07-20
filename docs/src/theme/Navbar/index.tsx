import Navbar from "@theme-original/Navbar";
import SearchBar from "@theme/SearchBar";
import { JSX } from "react";

export default function NavbarWrapper(props: any): JSX.Element {
  return (
    <div style={{ position: "relative" }}>
      <Navbar {...props} />
      <div
        style={{
          position: "absolute",
          top: "8px",
          right: "20px",
          zIndex: 100,
        }}
      >
        <SearchBar />
      </div>
    </div>
  );
}
