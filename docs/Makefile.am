if HAVE_DOXYGEN

.PHONY: all doxygen

doxyfile.stamp:
	$(DOXYGEN) $(top_srcdir)/docs/doxygen.cfg
	echo Timestamp > doxyfile.stamp

CLEANFILES = doxyfile.stamp

all-local: doxyfile.stamp
clean-local:
	rm -rf $(top_srcdir)/docs/{man,html,latex}
endif 

