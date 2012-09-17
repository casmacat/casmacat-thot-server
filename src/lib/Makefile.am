#######################################
# The list of libraries we are building seperated by spaces.
# The 'lib_' indicates that these build products will be installed
# in the $(libdir) directory. For example /usr/lib
lib_LTLIBRARIES = libcasmacat.la random-aligner.la

#######################################
# Build information for each library

# Sources for casmacat
libcasmacat_la_SOURCES = script.cpp

# Linker options 
libcasmacat_la_LDFLAGS = -lboost_system -lboost_date_time -lboost_regex -lboost_program_options -lboost_thread -lwebsocketpp -ljsoncpp

# Compiler options. Here we are adding the include directory
# to be searched for headers included in the source code.
libcasmacat_la_CPPFLAGS = -I$(top_srcdir)/src/include

random_aligner_la_SOURCES = random-aligner.cpp
random_aligner_la_LDFLAGS = -version-info 0:0:0 -module -export-dynamic $(LDFLAGS)
random_aligner_la_CPPFLAGS = -I$(top_srcdir)/src/include
