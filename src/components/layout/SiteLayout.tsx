import { Outlet } from 'react-router-dom'
import { CustomCursor } from '../motion/CustomCursor'
import { Intro } from '../motion/Intro'
import { Footer } from './Footer'
import { Navbar } from './Navbar'

export function SiteLayout() {
  return (
    <>
      <Intro />
      <Navbar />
      <Outlet />
      <Footer />
      <CustomCursor />
    </>
  )
}
