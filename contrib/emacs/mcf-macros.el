(require 'mcf-mode)

;;;###autoload
(define-derived-mode mcf-macros-mode mcf-mode "Minecraft-Function Macros"
  "Set major mode for editing Minecraft mcfunction macro file."
  :group 'mcf
  (setq-local font-lock-defaults
              (list (mcf-macros--font-lock-keywords) nil nil nil nil)))

(defun mcf-macros--font-lock-keywords ()
  (let ((copy (copy-tree mcf--font-lock-keywords)))
    (setcar (assoc "\\(^\\|run \\)\\([a-z]+\\)\\>" copy) "\\(^\\|run \\)\\( *[a-zA-Z_-]+\\)\\>")
    (setcar (assoc "^\\(#.*\\)$" copy) "^\\( *#.*\\)$")
    copy
  ))

(add-to-list 'auto-mode-alist '("\\.mcm\\'" . mcf-macros-mode))

(provide 'mcf-macros-mode)
;;; mcf-macros.el ends here
