import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight } from "@phosphor-icons/react";
import { READING_TOGETHER_PHOTO } from "@/content/editorialMedia";

/** A quiet photographic pause between the cause gallery and live shift search. */
export const EditorialPhotoNote = (): ReactElement => (
  <section aria-labelledby="photo-note-title" className="photo-note">
    <img src={READING_TOGETHER_PHOTO.src} alt="" loading="eager" decoding="async" />
    <div className="photo-note__copy">
      <p className="photo-note__eyebrow">Make it a regular thing</p>
      <h2 id="photo-note-title">There is room for you.</h2>
      <Link to="/explore">See open shifts <ArrowDownRight aria-hidden="true" size={18} /></Link>
    </div>
  </section>
);
