// Тема оформления: ключ в localStorage и скрипт, который выставляет сохранённую тему
// до первой отрисовки, чтобы страница не мигала светлой
// (приём из руководства Next.js «Preventing flash before hydration»)

export const THEME_KEY = "goalflow:theme";

export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
