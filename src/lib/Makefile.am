#######################################
# The list of libraries we are building seperated by spaces.
# The 'lib_' indicates that these build products will be installed
# in the $(libdir) directory. For example /usr/lib
lib_LTLIBRARIES = libcasmacat.la random-aligner.la random-confidence-estimator.la random-imt-engine.la random-mt-engine.la space-tokenizer.la 


#######################################
# Build information for each library

# Sources for casmacat
libcasmacat_la_SOURCES = script.cpp

# Linker options 
#libcasmacat_la_LDFLAGS = -lboost_system -lboost_date_time -lboost_regex -lboost_program_options -lboost_thread -lwebsocketpp -ljsoncpp

# Compiler options. Here we are adding the include directory
# to be searched for headers included in the source code.
libcasmacat_la_CPPFLAGS = -I$(top_srcdir)/src/include

random_aligner_la_SOURCES = random-aligner.cpp
random_aligner_la_LDFLAGS = -version-info 0:0:0 -module -export-dynamic $(LDFLAGS)
random_aligner_la_CPPFLAGS = -I$(top_srcdir)/src/include

random_confidence_estimator_la_SOURCES = random-confidence-estimator.cpp
random_confidence_estimator_la_LDFLAGS = -version-info 0:0:0 -module -export-dynamic $(LDFLAGS)
random_confidence_estimator_la_CPPFLAGS = -I$(top_srcdir)/src/include

random_imt_engine_la_SOURCES = random-imt-engine.cpp
random_imt_engine_la_LDFLAGS = -version-info 0:0:0 -module -export-dynamic $(LDFLAGS)
random_imt_engine_la_CPPFLAGS = -I$(top_srcdir)/src/include

random_mt_engine_la_SOURCES = random-mt-engine.cpp
random_mt_engine_la_LDFLAGS = -version-info 0:0:0 -module -export-dynamic $(LDFLAGS)
random_mt_engine_la_CPPFLAGS = -I$(top_srcdir)/src/include

space_tokenizer_la_SOURCES = space-tokenizer.cpp
space_tokenizer_la_LDFLAGS = -version-info 0:0:0 -module -export-dynamic $(LDFLAGS)
space_tokenizer_la_CPPFLAGS = -I$(top_srcdir)/src/include

### Python extension ###
if HAVE_BOOST_PYTHON
lib_LTLIBRARIES += pycasmacat.la
pycasmacat_la_SOURCES  = python-bindings.cpp
pycasmacat_la_LDFLAGS  = -version-info 0:0:0 -module -export-dynamic -l$(BOOST_PYTHON_LIB) -l$(PYTHON_LIB) $(LDFLAGS)
pycasmacat_la_CPPFLAGS = -I$(top_srcdir)/src/include -I$(PYTHON_INCLUDE_DIR)
endif

if HAVE_SWIG
BUILT_SOURCES = $(builddir)/casmacat_swig_wrap.cpp
SWIG_SOURCES = casmacat.i

pkgpython_PYTHON = casmacat.py
pkgpyexec_LTLIBRARIES   = _casmacat.la
_casmacat_la_SOURCES  = $(BUILT_SOURCES) $(SWIG_SOURCES)
_casmacat_la_CXXFLAGS = $(COMPILANCE_CXXFLAGS) $(AX_SWIG_PYTHON_CPPFLAGS) -I$(top_srcdir)/src/include 
_casmacat_la_LDFLAGS  = -version-info 0:0:0 -export-dynamic -module $(PYTHON_LDFLAGS) $(LDFLAGS)

$(builddir)/casmacat_swig_wrap.cpp : $(SWIG_SOURCES) 
	$(SWIG) $(AX_SWIG_PYTHON_OPT) -I$(top_srcdir)/src/include -o $@ $<
endif
